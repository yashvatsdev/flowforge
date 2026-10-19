import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { Receiver } from "@upstash/qstash";
import { consumeDelivery, DeliveryFailure, dispatchOutbox, LocalTransport, parseDelivery, type Delivery, type OperationalEvent } from "../src/lib/execution/delivery";
import { createQStashTransport, IngressError, limitedText, verifiedMessage } from "../src/lib/execution/qstash";
import { maintenanceHandler, workerHandler } from "../src/lib/execution/background-http";
import { backgroundRuntime } from "../src/lib/execution/background-runtime";
import type { Rpc } from "../src/lib/execution/runner";

const owner = "11111111-1111-4111-8111-111111111111", worker = "33333333-3333-4333-8333-333333333333", replacement = "44444444-4444-4444-8444-444444444444";
const message: Delivery = { version: 1, runId: owner, eventId: "1", deliveryId: "ff:1" };
const url = "https://flowforge.example/api/internal/execution-worker", key = "synthetic-current-signing-key", next = "synthetic-next-signing-key";
function signature(body: string, signingKey = key, subject = url, expiry = Math.floor(Date.now() / 1000) + 60) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "Upstash", sub: subject, exp: expiry, nbf: 0, body: createHash("sha256").update(body).digest("base64url") })).toString("base64url");
  return `${head}.${payload}.${createHmac("sha256", signingKey).update(`${head}.${payload}`).digest("base64url")}`;
}
const receiver = new Receiver({ currentSigningKey: key, nextSigningKey: next, devMode: false });
function request(body: string, sig = signature(body)) { return new Request(url, { method: "POST", headers: { "upstash-signature": sig }, body }); }

test("local delivery inbox and synchronous maintenance batch are bounded", async () => {
  const transport = new LocalTransport();
  for (let i = 0; i < 25; i++) await transport.publish(message, `publication:${i}`);
  await assert.rejects(() => transport.publish(message, "overflow"), e => e instanceof DeliveryFailure && e.category === "retryable");
  const runtime = backgroundRuntime({ NODE_ENV: "test", FLOWFORGE_DELIVERY_MODE: "local", FLOWFORGE_DELIVERY_DATABASE_URL: "http://127.0.0.1:18181",
    FLOWFORGE_DELIVERY_SERVICE_KEY: "synthetic-local-service", QSTASH_CURRENT_SIGNING_KEY: key, QSTASH_NEXT_SIGNING_KEY: next,
    FLOWFORGE_WORKER_URL: "http://localhost:43821/api/internal/execution-worker", FLOWFORGE_MAINTENANCE_TOKEN: "synthetic-local-maintenance-token-32-characters" });
  assert.equal(runtime.batch, 1);
});

test("untrusted streamed bodies have byte and read-deadline bounds without content-length", async () => {
  const tooLarge = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(new Uint8Array(1025)); controller.close(); } });
  await assert.rejects(() => limitedText({ headers: new Headers(), body: tooLarge }, 1024), e => e instanceof IngressError && e.status === 413);
  let cancelled = false;
  const stalled = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel() { cancelled = true; } });
  await assert.rejects(() => limitedText({ headers: new Headers(), body: stalled }, 1024), e => e instanceof IngressError && e.status === 408);
  assert.equal(cancelled, true);
});

test("official QStash verification: raw body, key rotation, issuer/expiry/URL/body binding, bounded strict payload", async () => {
  const raw = JSON.stringify(message);
  for (const k of [key, next]) assert.deepEqual(await verifiedMessage(request(raw, signature(raw, k)), receiver, url), message);
  for (const sig of ["invalid", signature(raw, "forged"), signature(raw, key, `${url}/wrong`), signature(raw, key, url, 1), signature(raw + " ")])
    await assert.rejects(() => verifiedMessage(request(raw, sig), receiver, url));
  await assert.rejects(() => verifiedMessage(new Request(url, { method: "POST", body: raw }), receiver, url));
  await assert.rejects(() => verifiedMessage(request("x".repeat(1025)), receiver, url));
  for (const value of [{ ...message, version: 2 }, { ...message, workspaceId: owner }, { ...message, eventId: "0" }, { ...message, eventId: "9999999999999999999" }, { ...message, deliveryId: "wrong" }, null]) assert.throws(() => parseDelivery(value));
  await assert.rejects(() => verifiedMessage(request(JSON.stringify({ ...message, version: 2 })), receiver, url));
});

test("QStash official SDK constructs minimal JSON, explicit retry/timeout/dedup headers; errors classify safely", async () => {
  const original = globalThis.fetch;
  let seen: { body: unknown; headers: Headers } | undefined;
  try {
    globalThis.fetch = async (_input, init) => { seen = { body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) }; return Response.json({ messageId: "test-publication" }); };
    const transport = createQStashTransport("synthetic-token", url);
    assert.equal(await transport.publish(message, "ff:1:1"), "test-publication");
    assert.deepEqual(seen!.body, message);
    assert.equal(seen!.headers.get("Upstash-Retries"), "4");
    assert.equal(seen!.headers.get("Upstash-Deduplication-Id"), "ff:1:1");
    assert.equal(seen!.headers.get("Upstash-Timeout"), "20s");
    for (const [status, expected] of [[429, "retryable"], [503, "retryable"], [401, "terminal"]] as const) {
      globalThis.fetch = async () => Response.json({ error: "sensitive transport details" }, { status });
      await assert.rejects(() => transport.publish(message, "id"), e => e instanceof DeliveryFailure && e.category === expected && !e.message.includes("sensitive"));
    }
    globalThis.fetch = async () => { throw new Error("sensitive network URL"); };
    await assert.rejects(() => transport.publish(message, "id"), e => e instanceof DeliveryFailure && e.category === "ambiguous");
  } finally { globalThis.fetch = original; }
});

test("worker/maintenance HTTP authorization fails closed without data disclosure or production bypass", async () => {
  let calls = 0;
  const rpc: Rpc = async () => { calls++; return { status: "terminal" }; };
  const handler = workerHandler(() => ({ rpc, receiver, url, log: () => {} }));
  assert.equal((await handler(request(JSON.stringify(message), "forged"))).status, 401); assert.equal(calls, 0);
  const response = await handler(request(JSON.stringify(message))); assert.equal(response.status, 204); assert.equal(await response.text(), "");
  const token = "synthetic-maintenance-token-at-least-32-characters";
  const maintenance = maintenanceHandler(() => ({ rpc, token, transport: new LocalTransport() }));
  assert.equal((await maintenance(new Request(url, { method: "POST", body: '{"action":"recover"}' }))).status, 401);
  assert.equal((await maintenance(new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: '{"action":"unbounded"}' }))).status, 400);
  assert.equal((await maintenance(new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: '{"action":"status"}' }))).status, 200);
  for (const env of [{}, { FLOWFORGE_DELIVERY_MODE: "local", NODE_ENV: "production" }, { FLOWFORGE_DELIVERY_MODE: "local", FLOWFORGE_DELIVERY_DATABASE_URL: "https://kixwwrmedqazurvdnfhi.supabase.co" }]) assert.throws(() => backgroundRuntime(env));
});

test("durable local delivery integration using real PostgreSQL SQL in isolated PGlite", async t => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
      create table auth.users(id uuid primary key);insert into auth.users values('${owner}');
      create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
    for (const f of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    const admin = () => db.exec("reset role");
    async function auth() { await admin(); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner, app_metadata: { provider: "google" }, amr: [{ method: "oauth" }] })]); await db.exec("set role authenticated"); }
    const service = async () => { await admin(); await db.exec("set role service_role"); };
    const signatures: Record<string, [string, string[]]> = {
      ff_delivery_claim: ["select public.ff_delivery_claim($1::uuid,$2::integer) as v", ["dispatcher", "batch"]],
      ff_delivery_settle: ["select public.ff_delivery_settle($1::bigint,$2::uuid,$3::bigint,$4::text,$5::text) as v", ["eid", "dispatcher", "fence", "outcome", "transport_id"]],
      ff_delivery_run_claim: ["select public.ff_delivery_run_claim($1::uuid,$2::bigint,$3::uuid) as v", ["rid", "eid", "worker"]],
      ff_delivery_recover: ["select public.ff_delivery_recover($1::integer) as v", ["batch"]],
      ff_exec_advance: ["select public.ff_exec_advance($1::uuid,$2::uuid,$3::bigint,$4::boolean,$5::integer) as v", ["rid", "worker", "fence", "complete", "checkpoint"]],
    };
    const rpc: Rpc = async (name, args) => { await service(); const [sql, fields] = signatures[name]; return (await db.query<{ v: unknown }>(sql, fields.map(f => args[f]))).rows[0].v; };
    async function scalar(sql: string) { await admin(); return (await db.query<{ v: unknown }>(sql)).rows[0].v; }
    async function clear() { await admin(); await db.exec("truncate flowforge_private.ff_delivery_attempts,flowforge_private.ff_execution_outbox,public.ff_run_steps,public.ff_runs restart identity"); }
    await t.test("new RPCs and tables default denied; Phase 2B disable switch covers new entrypoints", async () => {
      await assert.rejects(() => rpc("ff_delivery_claim", { dispatcher: worker, batch: 1 }));
      await admin(); await db.exec(readFileSync("supabase/operations/phase2c_enable_delivery.sql", "utf8"));
      await assert.rejects(() => rpc("ff_delivery_claim", { dispatcher: worker, batch: 1 }));
      await admin(); await db.exec(readFileSync("supabase/operations/phase2b_enable_execution.sql", "utf8"));
      assert.deepEqual(await rpc("ff_delivery_claim", { dispatcher: worker, batch: 1 }), []);
      await auth(); await assert.rejects(() => db.query("select public.ff_delivery_claim($1,1)", [worker]));
      await assert.rejects(() => db.query("select * from flowforge_private.ff_delivery_attempts"));
    });
    await auth(); await db.query("select public.ff_bootstrap()");
    const node = (id: string, kind: string, config: Record<string, string>) => ({ id, type: "forge", position: { x: 0, y: 0 }, data: { kind, label: id, config } });
    const graph = { id: "delivery", name: "Delivery", description: "", active: false, updatedAt: "2026-10-19T00:00:00Z", nodes: [node("a", "trigger", { amount: "1", email: "" }), node("b", "transform", { field: "result", value: "done" })], edges: [{ id: "ab", source: "a", target: "b" }] };
    await db.query("select public.ff_commit(0,$1::jsonb)", [JSON.stringify({ version: 1, workflows: [graph], executions: [], settings: { name: "Test", email: "", workspace: "Test", reduceMotion: false } })]);
    async function start(key = "key") { await auth(); const rid = (await db.query<{ v: { runId: string } }>("select public.ff_exec_start('delivery',1,'{}',$1) as v", [key])).rows[0].v.runId; return parseDelivery({ version: 1, runId: rid, eventId: String(await scalar(`select id::text as v from flowforge_private.ff_execution_outbox where run_id='${rid}'`)), deliveryId: `ff:${await scalar(`select id::text as v from flowforge_private.ff_execution_outbox where run_id='${rid}'`)}` }); }
    const logs: OperationalEvent[] = [], log = (v: OperationalEvent) => logs.push(v);
    await t.test("publication confirmation then local worker; duplicate/out-of-order deliveries preserve one result", async () => {
      const m = await start(), transport = new LocalTransport();
      assert.deepEqual(await dispatchOutbox(rpc, transport, log), { published: 1 });
      assert.equal(await scalar("select count(*)::int as v from flowforge_private.ff_delivery_attempts where outcome='published'"), 1);
      await transport.flush(m => consumeDelivery(rpc, m, log));
      assert.equal(await consumeDelivery(rpc, m, log), "done");
      assert.equal(await consumeDelivery(rpc, { ...m, eventId: "999", deliveryId: "ff:999" }, log), "done");
      assert.equal(await scalar(`select state as v from public.ff_runs where id='${m.runId}'`), "succeeded");
      assert.equal(await scalar("select count(*)::int as v from public.ff_run_steps where state='succeeded'"), 2);
    });
    await t.test("ambiguous publication, failed publication, expired dispatch claim and stale settle", async () => {
      await clear(); await start();
      await dispatchOutbox(rpc, { publish: async () => { throw new Error("secret transport failure"); } }, log);
      assert.equal(await scalar("select outcome as v from flowforge_private.ff_delivery_attempts"), "ambiguous");
      assert.equal(await scalar("select published_at is null as v from flowforge_private.ff_execution_outbox"), true);
      await admin(); await db.exec("update flowforge_private.ff_execution_outbox set available_at=clock_timestamp()-interval '1 second'");
      const first = (await rpc("ff_delivery_claim", { dispatcher: worker, batch: 1 }) as { eventId: string; generation: number }[])[0];
      await admin(); await db.exec("update flowforge_private.ff_execution_outbox set dispatch_until=clock_timestamp()-interval '1 second'");
      const second = (await rpc("ff_delivery_claim", { dispatcher: replacement, batch: 1 }) as { eventId: string; generation: number }[])[0];
      assert.equal(second.generation, first.generation + 1);
      assert.equal(await rpc("ff_delivery_settle", { eid: first.eventId, dispatcher: worker, fence: first.generation, outcome: "published", transport_id: "stale" }), false);
      assert.equal(await rpc("ff_delivery_settle", { eid: second.eventId, dispatcher: replacement, fence: second.generation, outcome: "retryable", transport_id: null }), true);
      assert.equal(await scalar("select published_at is null as v from flowforge_private.ff_execution_outbox"), true);
    });
    await t.test("worker crash, busy duplicate, expired run lease, stale fence, committed checkpoint recovery", async () => {
      await clear(); const m = await start();
      const claim = await rpc("ff_delivery_run_claim", { rid: m.runId, eid: m.eventId, worker }) as { generation: number };
      await rpc("ff_exec_advance", { rid: m.runId, worker, fence: claim.generation, complete: false, checkpoint: 0 });
      await rpc("ff_exec_advance", { rid: m.runId, worker, fence: claim.generation, complete: true, checkpoint: 0 });
      assert.equal(await consumeDelivery(rpc, m, log), "retry");
      await admin(); await db.exec("update public.ff_runs set lease_until=clock_timestamp()-interval '1 second'");
      await rpc("ff_delivery_recover", { batch: 25 });
      assert.equal(await consumeDelivery(rpc, m, log), "done");
      await assert.rejects(() => rpc("ff_exec_advance", { rid: m.runId, worker, fence: claim.generation, complete: true, checkpoint: 1 }));
      assert.equal(await scalar("select count(*)::int as v from public.ff_run_steps where state='succeeded' and node_id='a'"), 1);
    });
    await t.test("retry exhaustion visibly fails stranded run; deadlines and delayed cancelled delivery are inert", async () => {
      await clear(); const m = await start();
      for (let i = 0; i < 12; i++) { await admin(); await db.exec("update flowforge_private.ff_execution_outbox set available_at=clock_timestamp()-interval '1 second'"); await dispatchOutbox(rpc, { publish: async () => { throw new DeliveryFailure("retryable"); } }, log, 1); }
      await rpc("ff_delivery_recover", { batch: 25 });
      assert.equal(await scalar(`select error_code as v from public.ff_runs where id='${m.runId}'`), "delivery_exhausted");
      await clear(); const cancelled = await start(); await auth(); await db.query("select public.ff_exec_cancel($1)", [cancelled.runId]);
      assert.equal(await consumeDelivery(rpc, cancelled, log), "done");
      await clear(); const expired = await start(); await rpc("ff_delivery_run_claim", { rid: expired.runId, eid: expired.eventId, worker });
      await admin(); await db.exec("update public.ff_runs set deadline_at=clock_timestamp()-interval '1 second'");
      await rpc("ff_delivery_recover", { batch: 25 }); assert.equal(await scalar("select state as v from public.ff_runs"), "timed_out");
      assert.ok(!JSON.stringify(logs).includes("secret transport failure"));
    });
    await t.test("bounded worker yields and existing disable stops all new mutating RPCs", async () => {
      await clear(); const m = await start(); assert.equal(await consumeDelivery(rpc, m, log, 0), "retry");
      await admin(); await db.exec(readFileSync("supabase/operations/phase2b_disable_execution.sql", "utf8"));
      for (const [name, args] of [["ff_delivery_claim", { dispatcher: worker, batch: 1 }], ["ff_delivery_recover", { batch: 1 }], ["ff_delivery_run_claim", { rid: m.runId, eid: m.eventId, worker }]] as const) await assert.rejects(() => rpc(name, args));
    });
  } finally { await db.close(); }
});
