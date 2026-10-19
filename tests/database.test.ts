import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { starter } from "../src/lib/seeds";
import { simulate } from "../src/lib/engine";
const a="11111111-1111-4111-8111-111111111111", b="22222222-2222-4222-8222-222222222222";
const workspace = () => ({version:1,workflows:[starter()],executions:[],settings:{name:"Google user",email:"test@example.com",workspace:"Personal workspace",reduceMotion:false}});
test("PostgreSQL migration, bootstrap, RLS, revisions and import idempotency (local auth claims fixture)", async t => {
  const db = new PGlite();
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key); insert into auth.users values('${a}'),('${b}');
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
  `);
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to authenticated,anon; grant execute on all functions in schema auth to authenticated,anon;`);
  for (const migration of readdirSync("supabase/migrations").filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${migration}`,"utf8"));
  const session = async (id:string, provider="google") => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,amr:[{method:provider==="google"?"oauth":"password"}],email:"test@example.com",app_metadata:{provider},user_metadata:{name:"Google user"}})]); await db.exec("set role authenticated"); };
  const commit = (revision:number,doc:unknown,hash:string|null=null) => db.query<{revision:number}>("select public.ff_commit($1,$2::jsonb,$3,'edited') as revision",[revision,JSON.stringify(doc),hash]);
  const load = async()=> (await db.query<{doc: {revision:number;state:ReturnType<typeof workspace>}}>("select public.ff_load() as doc")).rows[0].doc;
  await t.test("bootstrap is idempotent and exposes only own profile/workspace",async()=>{
    await session(a); const one=await db.query("select public.ff_bootstrap()");const two=await db.query("select public.ff_bootstrap()");assert.deepEqual(one.rows,two.rows);
    assert.equal((await db.query("select * from public.ff_workspaces")).rows.length,1);
    assert.equal((await db.query("select * from public.ff_profiles")).rows.length,1);
  });
  await t.test("writes survive reload and stale revisions fail atomically",async()=>{
    await commit(0,workspace());assert.equal((await load()).state.workflows.length,1);
    const changed=workspace();changed.workflows[0].name="Saved edit";await commit(1,changed);
    await assert.rejects(()=>commit(1,workspace()),(error: unknown)=>{assert.equal((error as {code:string}).code,'PT409');return true;});
    assert.equal((await load()).state.workflows[0].name,"Saved edit");assert.equal((await load()).revision,2);
  });
  await t.test("direct writes cannot bypass optimistic concurrency",async()=>{
    await assert.rejects(()=>db.exec("update public.ff_workspaces set revision=0"),/permission denied/);
    await assert.rejects(()=>db.exec("delete from public.ff_workflows"),/permission denied/);
  });
  await t.test("malformed graph rolls back without deleting valid documents",async()=>{
    const bad=workspace();bad.workflows[0].nodes[1].id="n0";
    await assert.rejects(()=>commit(2,bad));assert.equal((await load()).revision,2);
    assert.equal((await load()).state.workflows.length,1);
  });
  await t.test("simulation snapshots round trip",async()=>{
    const doc={...workspace(),executions:[{...simulate(starter()),id:"run",time:new Date().toISOString(),sample:true}]};
    await commit(2,doc);assert.equal((await load()).state.executions.length,1);
  });
  await t.test("repeat import fingerprint does not duplicate or reapply documents",async()=>{
    await commit(3,workspace(),"a".repeat(64));await commit(0,{...workspace(),workflows:[]},"a".repeat(64));
    assert.equal((await load()).revision,4);assert.equal((await load()).state.workflows.length,1);
  });
  await t.test("second user cannot read or mutate first user's rows",async()=>{
    await session(b);await db.exec("select public.ff_bootstrap()");
    assert.equal((await db.query("select * from public.ff_workflows")).rows.length,0);
    assert.equal((await db.query("select * from public.ff_simulations")).rows.length,0);
    assert.equal((await db.query("select * from public.ff_imports")).rows.length,0);
    assert.equal((await db.query("select * from public.ff_preferences")).rows.length,1);
    assert.equal((await db.query("select * from public.ff_profiles")).rows.length,1);
    await commit(0,{...workspace(),workflows:[]});await session(a);assert.equal((await load()).state.workflows.length,1);
  });
  await t.test("email-only and anonymous principals cannot bootstrap, write or read",async()=>{
    await session(a,"email");assert.equal((await db.query("select * from public.ff_workspaces")).rows.length,0);
    await assert.rejects(()=>db.exec("select public.ff_bootstrap()"));await assert.rejects(()=>commit(4,workspace()));
    await db.exec("reset role; set role anon");await assert.rejects(()=>db.exec("select public.ff_load()"));
  });
  await db.close();
});
