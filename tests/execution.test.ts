import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { compileWorkflow, evaluateNode, type CompiledNode } from "../src/lib/execution/compiler";
import { drainExecutions, type Rpc } from "../src/lib/execution/runner";
import type { Workflow } from "../src/lib/engine";

const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const worker = "33333333-3333-4333-8333-333333333333", secondWorker = "44444444-4444-4444-8444-444444444444";
function graph(): Workflow {
  const node = (id: string, kind: "trigger" | "transform" | "condition", config: Record<string, string>) => ({ id, type: "forge", position: { x: 0, y: 0 }, data: { kind, label: id, config } });
  return { id: "tree", name: "Tree", description: "", active: false, updatedAt: "2026-10-19T00:00:00Z", nodes: [node("a", "trigger", { amount: "1", email: "" }), node("b", "condition", { threshold: "10" }), node("c", "transform", { field: "left", value: "yes" }), node("d", "transform", { field: "right", value: "yes" })], edges: [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c", sourceHandle: "true" }, { id: "bd", source: "b", target: "d", sourceHandle: "false" }] };
}

test("real graph compiler rejects joins, cycles, disconnected graphs, unsafe fields and disabled handlers", () => {
  assert.deepEqual(compileWorkflow(graph()).map(n => n.id), ["a", "b", "c", "d"]);
  const cases: Workflow[] = [];
  const join = graph(); join.edges.push({ id: "cd", source: "c", target: "d" }); cases.push(join);
  const cycle = graph(); cycle.edges.push({ id: "dc", source: "d", target: "b" }); cases.push(cycle);
  const detached = graph(); detached.edges.pop(); cases.push(detached);
  const unsafe = graph(); unsafe.nodes[2].data.config.field = "__proto__"; cases.push(unsafe);
  const http = graph(); http.nodes[2].data = { kind: "http", label: "HTTP", config: { url: "https://example.com", method: "GET", fail: "false" } }; cases.push(http);
  const huge = graph(); huge.description = "x".repeat(262145); cases.push(huge);
  const tooMany = graph(); tooMany.nodes.push(...Array.from({ length: 97 }, (_, i) => ({ ...structuredClone(tooMany.nodes[2]), id: `extra${i}` }))); cases.push(tooMany);
  const invalidNumber = graph(); invalidNumber.nodes[1].data.config.threshold = "0x10"; cases.push(invalidNumber);
  for (const bad of cases) assert.throws(() => compileWorkflow(bad));
});
test("literal handlers preserve sibling and nested payload isolation; numeric conditions are strict", () => {
  const node: CompiledNode = { id: "t", kind: "transform", config: { field: "x", value: "literal ${input}" }, parent: "a", port: "" };
  const input = { amount: 12, nested: { keep: true } };
  const first = evaluateNode(node, input); (first.output.nested as { keep: boolean }).keep = false;
  assert.deepEqual(input, { amount: 12, nested: { keep: true } });
  assert.equal(evaluateNode(node, input).output.x, "literal ${input}");
  assert.equal(evaluateNode({ ...node, kind: "condition", config: { threshold: "10" } }, input).branch, true);
  assert.throws(() => evaluateNode({ ...node, kind: "condition", config: { threshold: "10" } }, { amount: "12" }));
});
test("standalone runner rejects hosted targets and production without leaking its service credential", () => {
  for (const [url, mode] of [["https://kixwwrmedqazurvdnfhi.supabase.co", "test"], ["http://localhost:54321", "production"]] as const) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/run-executions.mts"], { encoding: "utf8", env: { ...process.env, NODE_ENV: mode, FLOWFORGE_RUNNER_URL: url, FLOWFORGE_RUNNER_SERVICE_KEY: "never-print-this-service-secret" }, timeout: 10000 });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /hosted\/production execution is disabled/);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("never-print-this-service-secret"));
  }
});

async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key); insert into auth.users values('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    grant usage on schema auth to authenticated,anon; grant execute on all functions in schema auth to authenticated,anon;`);
  for (const file of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  // Local fixture opt-in only; the actual migration must remain fail-closed.
  const disabled = (await db.query<{ start: boolean; claim: boolean; advance: boolean }>(`select
    has_function_privilege('authenticated','public.ff_exec_start(text,bigint,jsonb,text)','EXECUTE') as start,
    has_function_privilege('service_role','public.ff_exec_claim(uuid)','EXECUTE') as claim,
    has_function_privilege('service_role','public.ff_exec_advance(uuid,uuid,bigint,boolean,integer)','EXECUTE') as advance`)).rows[0];
  assert.deepEqual(disabled, { start: false, claim: false, advance: false });
  await db.exec(readFileSync('supabase/operations/phase2b_enable_execution.sql', 'utf8'));
  const session = async (id = owner, provider = "google") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, app_metadata: { provider }, amr: [{ method: provider === "google" ? "oauth" : "password" }] })]);
    await db.exec("set role authenticated");
  };
  await session(); await db.query("select public.ff_bootstrap()");
  const doc = { version: 1, workflows: [graph()], executions: [], settings: { name: "Owner", email: "", workspace: "Mine", reduceMotion: false } };
  await db.query("select public.ff_commit(0,$1::jsonb)", [JSON.stringify(doc)]);
  const rpc: Rpc = async (name, args) => {
    // Explicit allowlist; this fixture is never exposed outside the test process.
    const signatures: Record<string, [string, string[]]> = {
      ff_exec_claim: ["select public.ff_exec_claim($1::uuid) as v", ["worker"]],
      ff_exec_advance: ["select public.ff_exec_advance($1::uuid,$2::uuid,$3::bigint,$4::boolean,$5::integer) as v", ["rid", "worker", "fence", "complete", "checkpoint"]],
    };
    const [sql, keys] = signatures[name]; return (await db.query<{ v: unknown }>(sql, keys.map(k => args[k]))).rows[0].v;
  };
  const asWorker = () => db.exec("reset role; set role service_role");
  const start = async (key = "key", input: unknown = { amount: 12 }, expected = 1) => (await db.query<{ v: { runId: string; state: string; replayed: boolean; limited?: boolean } }>("select public.ff_exec_start('tree',$1,$2::jsonb,$3) as v", [expected, JSON.stringify(input), key])).rows[0].v;
  const admin = () => db.exec("reset role");
  const run = async (id: string) => { await admin(); return (await db.query<{ state: string; cursor: number; snapshot: Workflow; generation: number; output_bytes: number }>("select * from public.ff_runs where id=$1", [id])).rows[0]; };
  const claim = async (id = worker) => { await asWorker(); return await rpc("ff_exec_claim", { worker: id }) as { runId: string; generation: number; checkpoint: number } | null; };
  const advance = async (r: { runId: string; generation: number }, complete = false, checkpoint = 0, id = worker) => { await asWorker(); return rpc("ff_exec_advance", { rid: r.runId, worker: id, fence: r.generation, complete, checkpoint }); };
  return { db, session, start, asWorker, rpc, admin, run, claim, advance, doc };
}

test("PostgreSQL durable execution contracts", async t => {
  const f = await fixture(); const { db } = f;
  t.after(() => db.close());
  async function clear() { await f.admin(); await db.exec("truncate flowforge_private.ff_delivery_attempts,flowforge_private.ff_execution_outbox,public.ff_run_steps,public.ff_runs"); await f.session(); }

  await t.test("atomic start uses saved snapshot and SHA-256 request hash; retries replay before quota/revision checks", async () => {
    const first = await f.start(); const again = await f.start(); assert.equal(again.runId, first.runId); assert.equal(again.replayed, true);
    await assert.rejects(() => f.start("key", { amount: 13 }), /Idempotency/);
    await assert.rejects(() => f.start("stale", {}, 0), /Revision conflict/);
    await f.admin(); assert.equal((await db.query<{ n: number }>("select length(request_hash) as n from public.ff_runs")).rows[0].n, 64);
    await assert.rejects(() => db.exec("update public.ff_runs set snapshot='{}'"), /immutable/);
    await f.session(); const updated = structuredClone(f.doc); updated.workflows[0].name = "Changed after admission";
    await db.query("select public.ff_commit(1,$1::jsonb)", [JSON.stringify(updated)]);
    assert.equal((await f.start()).runId, first.runId);
    assert.equal((await f.run(first.runId)).snapshot.name, "Tree");
    await f.session(); await db.query("select public.ff_commit(2,$1::jsonb)", [JSON.stringify(f.doc)]);
    // Restore only the test revision through the fixture administrator.
    await f.admin(); await db.exec("update public.ff_workspaces set revision=1");
  });
  await t.test("RLS, API reads, outbox and worker capability isolate tenants and block forged results", async () => {
    await f.session(); const id = (await f.start()).runId;
    await assert.rejects(() => db.exec("update public.ff_runs set state='succeeded'"), /permission denied/);
    await assert.rejects(() => db.exec("insert into public.ff_run_steps(run_id) values(null)"), /permission denied/);
    await assert.rejects(() => db.exec("select * from flowforge_private.ff_execution_outbox"), /permission denied/);
    await assert.rejects(() => f.rpc("ff_exec_claim", { worker }), /permission denied/);
    await f.asWorker(); await assert.rejects(() => db.exec("select * from public.ff_runs"), /permission denied/);
    await assert.rejects(() => db.exec("update public.ff_run_steps set state='succeeded'"), /permission denied/);
    await f.session(other); await db.exec("select public.ff_bootstrap()");
    assert.equal((await db.query("select * from public.ff_runs")).rows.length, 0);
    assert.equal((await db.query("select * from public.ff_run_steps")).rows.length, 0);
    await assert.rejects(() => db.query("select public.ff_exec_cancel($1)", [id]), /not found/);
    await assert.rejects(() => db.query("select public.ff_exec_read('details',$1)", [id]), /not found/);
    await f.session(owner, "email"); await assert.rejects(() => f.start("no-email"), /insufficient|permission/i);
    await db.exec("reset role; set role anon"); await assert.rejects(() => db.exec("select public.ff_exec_read('history')"), /permission denied/);
  });
  await t.test("runner checkpoints execute numeric branches; skipped branch cannot receive sibling payload", async () => {
    await clear(); const id = (await f.start()).runId; await f.asWorker();
    assert.equal(await drainExecutions(f.rpc, 1, worker), 1);
    assert.equal((await f.run(id)).state, "succeeded");
    const steps = (await db.query<{ node_id: string; state: string; output: Record<string, unknown> }>("select * from public.ff_run_steps order by ordinal")).rows;
    assert.equal(steps[2].output.left, "yes"); assert.equal(steps[3].state, "skipped"); assert.deepEqual(steps[3].output, {});
    assert.equal(steps[0].output.left, undefined);
    await f.session(); const read = (await db.query<{ v: { runs: unknown[] } }>("select public.ff_exec_read('history') as v")).rows[0].v; assert.equal(read.runs.length, 1);
    await f.session(other); assert.equal((await db.query("select * from public.ff_run_steps")).rows.length, 0);
  });
  await t.test("expired lease abandons attempt, increases fence and resumes only uncommitted work", async () => {
    await clear(); const id = (await f.start()).runId; const first = (await f.claim())!;
    await f.advance(first); await f.advance(first, true); // committed trigger
    await f.advance(first, false, 1); // interrupted condition
    await f.admin(); await db.query("update public.ff_runs set lease_until=clock_timestamp()-interval '1 second' where id=$1", [id]);
    await assert.rejects(() => f.advance(first, true, 1), /lease lost/);
    const next = (await f.claim(secondWorker))!; assert.equal(next.generation, first.generation + 1); assert.equal(next.checkpoint, 1);
    await assert.rejects(() => f.advance(first, true, 1), /lease lost/);
    await f.advance(next, false, 1, secondWorker); await f.advance(next, true, 1, secondWorker);
    await f.admin(); const rows = (await db.query<{ node_id: string; attempt: number; state: string }>("select node_id,attempt,state from public.ff_run_steps order by ordinal,attempt")).rows;
    assert.deepEqual(rows.map(r => r.state), ["succeeded", "abandoned", "succeeded"]);
    assert.equal(rows.filter(r => r.node_id === "a").length, 1);
    // Replayed completion is fenced by checkpoint index; cannot finish next node.
    await f.advance(next, true, 1, secondWorker); assert.equal((await f.run(id)).cursor, 2);
  });
  await t.test("fan-out siblings inherit isolated payloads and saved workflow deletion preserves run provenance", async () => {
    await clear(); const workflow = graph(); workflow.nodes.splice(1, 1);
    workflow.edges = [{ id: "ac", source: "a", target: "c" }, { id: "ad", source: "a", target: "d" }];
    await f.admin(); await db.query("update public.ff_workflows set document=$1::jsonb", [JSON.stringify(workflow)]);
    await f.session(); const id = (await f.start("fanout")).runId;
    await f.admin(); await db.exec("delete from public.ff_workflows");
    await f.asWorker(); await drainExecutions(f.rpc, 1, worker);
    assert.equal((await f.run(id)).state, "succeeded");
    const rows = (await db.query<{ node_id: string; output: Record<string, unknown> }>("select * from public.ff_run_steps where run_id=$1 order by ordinal", [id])).rows;
    assert.deepEqual(rows.map(r => r.output), [{ amount: 12 }, { amount: 12, left: "yes" }, { amount: 12, right: "yes" }]);
    await db.query("insert into public.ff_workflows(workspace_id,id,document) select id,'tree',$1::jsonb from public.ff_workspaces where owner_id=$2", [JSON.stringify(graph()), owner]);
  });
  await t.test("cooperative cancellation wins before checkpoint; terminal cancellation is idempotent", async () => {
    await clear(); const id = (await f.start()).runId; const c = (await f.claim())!; await f.advance(c);
    await f.session(); assert.equal((await db.query<{ v: { state: string } }>("select public.ff_exec_cancel($1) as v", [id])).rows[0].v.state, "cancellation_requested");
    await f.advance(c, true); assert.equal((await f.run(id)).state, "cancelled");
    await f.session(); assert.equal((await db.query<{ v: { state: string } }>("select public.ff_exec_cancel($1) as v", [id])).rows[0].v.state, "cancelled");
    await f.admin(); assert.equal((await db.query<{ state: string }>("select state from public.ff_run_steps")).rows[0].state, "cancelled");
  });
  await t.test("node failures stop descendants and deterministic errors are never retried", async () => {
    await clear(); const id = (await f.start("bad-number", { amount: "not numeric" })).runId;
    await f.asWorker(); await drainExecutions(f.rpc, 1, worker);
    assert.equal((await f.run(id)).state, "failed");
    const rows = (await db.query<{ state: string; error_code: string }>("select state,error_code from public.ff_run_steps order by ordinal")).rows;
    assert.equal(rows.length, 2); assert.equal(rows[1].state, "failed"); assert.equal(rows[1].error_code, "invalid_numeric_input");
  });
  await t.test("two concurrent admissions reserve slots transactionally; same-key starts collapse", async () => {
    await clear(); const [one, duplicate, two, third] = await Promise.all([f.start("one"), f.start("one"), f.start("two"), f.start("three")]);
    assert.equal(one.runId, duplicate.runId); assert.ok(two.runId); assert.equal(third.limited, true);
    await f.admin(); assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.ff_runs")).rows[0].count, 2);
  });
  await t.test("sliding-minute start quota counts only accepted new runs", async () => {
    await clear();
    for (let i = 0; i < 10; i++) { const r = await f.start(`rate-${i}`); assert.ok(r.runId); await db.query("select public.ff_exec_cancel($1)", [r.runId]); }
    assert.equal((await f.start("rate-10")).limited, true);
    assert.equal((await f.start("rate-0")).replayed, true);
  });
  await t.test("database admission rejects oversized input and unsupported saved graphs", async () => {
    await clear(); await assert.rejects(() => f.start("large", { data: "x".repeat(65536) }), /Invalid start/);
    await f.admin(); const bad = graph(); bad.edges.push({ id: "cd", source: "c", target: "d" });
    await db.query("update public.ff_workflows set document=$1::jsonb", [JSON.stringify(bad)]);
    await f.session(); await assert.rejects(() => f.start("join"), /malformed/);
    await f.admin(); await db.query("update public.ff_workflows set document=$1::jsonb", [JSON.stringify(graph())]);
  });
  await t.test("deadline, output limits, bounded crash retries and outbox records", async () => {
    await clear(); const id = (await f.start()).runId; const c = (await f.claim())!;
    await f.admin(); await db.query("update public.ff_runs set deadline_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    await f.advance(c); assert.equal((await f.run(id)).state, "timed_out");
    await clear(); const big = await f.start("bytes", { amount: 12, pad: "x".repeat(65000) });
    await f.admin(); await db.query("update public.ff_runs set output_bytes=1048500 where id=$1", [big.runId]);
    await f.asWorker(); await drainExecutions(f.rpc, 1, worker); assert.equal((await f.run(big.runId)).state, "failed");
    await clear(); const crash = await f.start("crash");
    for (let i = 0; i < 3; i++) { const c = (await f.claim())!; await f.advance(c); await f.admin(); await db.query("update public.ff_runs set lease_until=clock_timestamp()-interval '1 second' where id=$1", [crash.runId]); }
    const final = (await f.claim())!; await f.advance(final); assert.equal((await f.run(crash.runId)).state, "failed");
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from flowforge_private.ff_execution_outbox where run_id=$1", [crash.runId])).rows[0].count, 2);
  });
  await t.test("maximum queue wait expires without running a node", async () => {
    await clear(); const source = await f.start("source"); await f.admin();
    const old = (await db.query<{ id: string }>(`insert into public.ff_runs(workspace_id,workflow_id,workspace_revision,snapshot,plan,manual_input,idempotency_key,request_hash,created_at)
      select workspace_id,workflow_id,workspace_revision,snapshot,plan,manual_input,'old-queued',request_hash,clock_timestamp()-interval '31 minutes' from public.ff_runs where id=$1 returning id`, [source.runId])).rows[0].id;
    await f.session(); await db.query("select public.ff_exec_cancel($1)", [source.runId]);
    assert.equal(await f.claim(), null); assert.equal((await f.run(old)).state, "timed_out");
    assert.equal((await db.query("select * from public.ff_run_steps where run_id=$1", [old])).rows.length, 0);
  });
  await t.test("natural per-node and aggregate output growth is bounded", async () => {
    for (const aggregate of [false, true]) {
      await clear(); const workflow = graph(); workflow.edges = []; workflow.nodes = [workflow.nodes[0]];
      for (let i = 1; i < (aggregate ? 25 : 2); i++) {
        const id = `step${i}`; workflow.nodes.push({ id, type: "forge", position: { x: 0, y: 0 }, data: { kind: "transform", label: id, config: { field: id, value: aggregate ? "x" : "x".repeat(10000) } } });
        workflow.edges.push({ id: `edge${i}`, source: workflow.nodes[i - 1].id, target: id });
      }
      await f.admin(); await db.query("update public.ff_workflows set document=$1::jsonb", [JSON.stringify(workflow)]);
      await f.session(); const r = await f.start("growing", { amount: 12, pad: "x".repeat(aggregate ? 50000 : 60000) });
      await f.asWorker(); await drainExecutions(f.rpc, 1, worker);
      const result = await f.run(r.runId); assert.equal(result.state, "failed"); assert.ok(result.output_bytes <= 1048576);
      assert.equal((await db.query<{ error_code: string }>("select error_code from public.ff_runs where id=$1", [r.runId])).rows[0].error_code, "output_limit");
    }
    await f.admin(); await db.query("update public.ff_workflows set document=$1::jsonb", [JSON.stringify(graph())]);
  });
  await t.test("disable/re-enable blocks direct start/worker RPCs and preserves data, reads and Phase 1 access", async () => {
    await clear(); const id = (await f.start('pause')).runId;
    await f.admin(); const before = (await db.query("select to_jsonb(r) as v from public.ff_runs r where id=$1", [id])).rows;
    await db.exec(readFileSync('supabase/operations/phase2b_disable_execution.sql', 'utf8'));
    await f.session(); await assert.rejects(() => f.start('disabled'), /permission denied/);
    await assert.rejects(() => db.query('select public.ff_exec_claim($1::uuid)', [worker]), /permission denied/);
    assert.ok((await db.query('select public.ff_load()')).rows.length);
    assert.ok((await db.query("select public.ff_exec_read('details',$1)", [id])).rows.length);
    await f.asWorker(); await assert.rejects(() => f.rpc('ff_exec_claim', { worker }), /permission denied/);
    await f.admin(); assert.deepEqual((await db.query("select to_jsonb(r) as v from public.ff_runs r where id=$1", [id])).rows, before);
    await db.exec(readFileSync('supabase/operations/phase2b_enable_execution.sql', 'utf8'));
    await f.session(); assert.equal((await f.start('pause')).runId, id);
    await f.admin();
    const hashes = await db.exec(readFileSync('supabase/verification/phase1_data_fingerprints.sql', 'utf8'));
    assert.ok(hashes.some(result => result.rows.length === 6));
  });
});
