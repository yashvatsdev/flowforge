/** Disposable local PostgreSQL only. Never accepts a database URL or hosted target.
 * Requires PostgreSQL binaries and the already installed Supabase CLI; see runbook.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('.');
const bin=process.env.FLOWFORGE_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const cli=process.env.FLOWFORGE_TEST_SUPABASE_CLI;
if(!cli)throw Error('Set FLOWFORGE_TEST_SUPABASE_CLI to the installed CLI executable');
const evidenceRoot=join(root,'.phase2b-evidence');mkdirSync(evidenceRoot,{recursive:true});
const evidence=mkdtempSync(join(evidenceRoot,'pg-'));
const data=join(evidence,'cluster');
assert.equal(resolve(data,'../..'),evidenceRoot);
const results=[];let started=false;let server;
const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('PG'))delete env[k];
env.PGCONNECT_TIMEOUT='3';
const port=await new Promise((ok,fail)=>{const s=createServer();s.on('error',fail);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
function command(exe,args,input='',extra={}) {
  return new Promise((ok,fail)=>{
    const child=spawn(exe,args,{cwd:root,env:{...env,...extra},windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
    child.on('error',fail);child.on('close',code=>ok({code,stdout,stderr}));child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}
async function checked(exe,args,input='',extra={}) {const r=await command(exe,args,input,extra);if(r.code!==0)throw Error(`${exe}: ${r.stderr||r.stdout}`);return r.stdout.trim();}
async function sql(q,db='ff2b',app='ff2b-audit') {
  return checked(join(bin,'psql.exe'),['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',db],q,{PGAPPNAME:app,PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=8000'});
}
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const worker='33333333-3333-4333-8333-333333333333',replacement='44444444-4444-4444-8444-444444444444';
const literal=v=>"'"+v.replaceAll("'","''")+"'";
const claims=JSON.stringify({sub:owner,app_metadata:{provider:'google'},amr:[{method:'oauth'}]});
const session=(q,role='authenticated')=>`begin;set local role ${role};set local request.jwt.claims=${literal(claims)};${q};commit;`;
const auth=(q,app='ff2b-user')=>sql(session(q),'ff2b',app);
const service=(q,app='ff2b-worker')=>sql(session(q,'service_role'),'ff2b',app);
const json=s=>s.trim()?JSON.parse(s.trim().split('\n').at(-1)):null;
const start=(key,amount=12,app='ff2b-start')=>auth(`select public.ff_exec_start('tree',1,'{"amount":${amount}}'::jsonb,${literal(key)})`,app).then(json);
const claim=(id=worker,app='ff2b-claim')=>service(`select public.ff_exec_claim('${id}')`,app).then(json);
const advance=(c,complete=false,index=c.checkpoint,id=worker,app='ff2b-advance')=>service(`select public.ff_exec_advance('${c.runId}','${id}',${c.generation},${complete},${index})`,app).then(json);
const cancel=(rid,app='ff2b-cancel')=>auth(`select public.ff_exec_cancel('${rid}')`,app).then(json);
const state=rid=>sql(`select state from public.ff_runs where id='${rid}'`);
let deliveryInstalled=false;
const clear=()=>sql(`truncate ${deliveryInstalled?'flowforge_private.ff_delivery_attempts,':''}flowforge_private.ff_execution_outbox,public.ff_run_steps,public.ff_runs`); // fresh owned fixture only
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(query,predicate){const end=Date.now()+6000;while(Date.now()<end){const v=await sql(query);if(predicate(v))return v;await delay(25);}throw Error('Session barrier timed out');}
async function hold(query,role='postgres') {
  const pending=sql(session(`${query};select pg_sleep(1.5)`,role),'ff2b','ff2b-holder');
  await until("select count(*) from pg_stat_activity where application_name='ff2b-holder' and wait_event='PgSleep'",v=>Number(v)===1);
  return {pending};
}
async function contendedStart(keys) {
  const h=await hold(`select id from public.ff_workspaces where owner_id='${owner}' for update`);
  const requests=keys.map((key,i)=>start(key,12,`ff2b-race${i}`));
  const pids=await until("select coalesce(json_agg(pid),'[]') from pg_stat_activity where application_name like 'ff2b-race%' and wait_event_type='Lock'",v=>JSON.parse(v).length>=keys.length);
  await h.pending;const values=await Promise.all(requests);results.push({barrierPids:JSON.parse(pids)});return values;
}
const workflow={id:'tree',name:'Fixture',description:'',active:false,updatedAt:'2026-10-19T00:00:00Z',nodes:[{id:'a',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Manual',config:{amount:'1',email:''}}},{id:'b',type:'forge',position:{x:0,y:0},data:{kind:'transform',label:'Literal',config:{field:'result',value:'done'}}}],edges:[{id:'ab',source:'a',target:'b'}]};
const doc={version:1,workflows:[workflow],executions:[],settings:{name:'Fixture',email:'',workspace:'Fixture',reduceMotion:false}};
const authSchema=`create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;`;
const names=['20261018215836_phase1_workspaces.sql','20261018225425_phase1_revision_conflict_status.sql','20261019110206_phase2b_execution_core.sql'];
async function migrate(db,folder) {
  const url=`postgresql://postgres@127.0.0.1:${port}/${db}?sslmode=disable`;
  const r=await command(cli,['migration','up','--db-url',url,'--workdir',folder]);
  writeFileSync(join(evidence,`${db}-cli-${Date.now()}.log`),r.stdout+r.stderr);return r;
}
async function workdir(name,files) {const dir=join(evidence,name);mkdirSync(join(dir,'supabase','migrations'),{recursive:true});for(const f of files)copyFileSync(join(root,'supabase','migrations',f),join(dir,'supabase','migrations',f));return dir;}
try {
  assert.equal(await checked(cli,['--version']),'2.121.0','Revalidate atomicity procedure for a different CLI release');
  await checked(join(bin,'initdb.exe'),['-D',data,'-A','trust','-U','postgres','--no-locale','--encoding=UTF8']);
  const log=openSync(join(evidence,'postgres.log'),'a');
  server=spawn(join(bin,'postgres.exe'),['-D',data,'-h','127.0.0.1','-p',String(port),'-c','max_connections=20'],{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});closeSync(log);
  server.on('error',()=>{});server.unref();started=true;
  let ready=false;for(let i=0;i<30;i++){try{await sql('select 1','postgres');ready=true;break;}catch{await delay(250);}}
  if(!ready)throw Error('Disposable PostgreSQL failed to start; inspect its retained log');
  await sql('create role anon;create role authenticated;create role service_role;create database ff2b;create database ff2b_failed;','postgres');
  for(const db of ['ff2b','ff2b_failed'])await sql(authSchema,db);
  const successDir=await workdir('success',names);
  const applied=await migrate('ff2b',successDir);assert.equal(applied.code,0,applied.stderr||applied.stdout);
  writeFileSync(join(evidence,'inventory-disabled.json'),await sql(readFileSync(join(root,'supabase','verification','phase2b_inventory.sql'),'utf8')));
  assert.equal(await sql('select count(*) from supabase_migrations.schema_migrations'),'3');
  assert.equal(await sql("select has_function_privilege('authenticated','public.ff_exec_start(text,bigint,jsonb,text)','EXECUTE')"),'f');
  assert.equal(await sql("select has_function_privilege('service_role','public.ff_exec_claim(uuid)','EXECUTE')"),'f');
  results.push({test:'supported CLI commits DDL/history together; admission and worker grants default OFF',pass:true});
  const failedDir=await workdir('failed',names.slice(0,2));assert.equal((await migrate('ff2b_failed',failedDir)).code,0);
  await sql(session(`select public.ff_bootstrap();select public.ff_commit(0,${literal(JSON.stringify(doc))}::jsonb)`),'ff2b_failed');
  const before=await sql('select md5(document::text) from public.ff_workflows','ff2b_failed');
  writeFileSync(join(failedDir,'supabase','migrations',names[2]),readFileSync(join(root,'supabase','migrations',names[2]),'utf8')+'\nselect 1/0;\n');
  const failed=await migrate('ff2b_failed',failedDir);assert.notEqual(failed.code,0);
  assert.equal(await sql("select to_regclass('public.ff_runs') is null",'ff2b_failed'),'t');
  assert.equal(await sql('select count(*) from supabase_migrations.schema_migrations','ff2b_failed'),'2');
  assert.equal(await sql('select md5(document::text) from public.ff_workflows','ff2b_failed'),before);
  results.push({test:'injected final-statement failure rolls back complete migration and history; Phase 1 fixture survives',pass:true});
  await sql(readFileSync(join(root,'supabase','operations','phase2b_enable_execution.sql'),'utf8'));
  await auth(`select public.ff_bootstrap();select public.ff_commit(0,${literal(JSON.stringify(doc))}::jsonb)`);
  let values=await contendedStart(['slot-a','slot-b','slot-c']);assert.equal(values.filter(v=>v.runId).length,2);assert.equal(values.filter(v=>v.limited).length,1);
  results.push({test:'independent sessions serialize workspace admission and reserve only two slots',pass:true});
  await clear();values=await contendedStart(['same-key','same-key']);assert.equal(values[0].runId,values[1].runId);assert.equal(values.filter(v=>v.replayed).length,1);
  await assert.rejects(()=>start('same-key',13),/Idempotency key/);assert.equal(await sql('select count(*) from public.ff_runs'),'1');
  results.push({test:'racing identical idempotency keys collapse; mismatched input rejected',pass:true});
  await clear();for(let i=0;i<9;i++)await cancel((await start(`rate-${i}`)).runId);
  values=await contendedStart(['rate-9','rate-10']);assert.equal(values.filter(v=>v.runId).length,1);assert.equal(values.filter(v=>v.limited).length,1);
  results.push({test:'competing tenth/eleventh starts enforce sliding-minute quota',pass:true});
  await clear();const r=await start('leases');const leases=await Promise.all([claim(worker,'ff2b-lease-a'),claim(replacement,'ff2b-lease-b')]);assert.equal(leases.filter(Boolean).length,1);
  const initial=leases.find(Boolean);const initialWorker=leases[0]?worker:replacement;await advance(initial,false,0,initialWorker);
  await sql(`update public.ff_runs set lease_until=clock_timestamp()-interval '1 second' where id='${r.runId}'`);
  const next=await claim(replacement);assert.equal(next.generation,initial.generation+1);await assert.rejects(()=>advance(initial,true,0,initialWorker),/lease lost/);
  await advance(next,false,0,replacement);await advance(next,true,0,replacement);await advance(next,false,1,replacement);await advance(next,true,1,replacement);
  assert.equal(await state(r.runId),'succeeded');assert.equal(await sql("select count(*) from public.ff_run_steps where node_id='a' and state='succeeded'"),'1');
  assert.equal(await sql("select count(*) from public.ff_run_steps where state='abandoned'"),'1');
  results.push({test:'competing leases, expired attempt, generation fencing and durable recovery',pass:true});
  await clear();const cancelled=await start('cancel-first');const c=await claim();await advance(c);
  let h=await hold(`select public.ff_exec_cancel('${cancelled.runId}')`,'authenticated');const pendingAdvance=advance(c,true,0,worker,'ff2b-cancel-race');
  await until("select count(*) from pg_stat_activity where application_name='ff2b-cancel-race' and wait_event_type='Lock'",v=>Number(v)===1);
  await h.pending;await pendingAdvance;assert.equal(await state(cancelled.runId),'cancelled');
  assert.equal(await sql("select count(*) from public.ff_run_steps where state='succeeded'"),'0');
  await clear();const finished=await start('complete-first');const f=await claim();await advance(f);await advance(f,true);await advance(f,false,1);
  h=await hold(`select public.ff_exec_advance('${f.runId}','${worker}',${f.generation},true,1)`,'service_role');const pendingCancel=cancel(finished.runId,'ff2b-complete-race');
  await until("select count(*) from pg_stat_activity where application_name='ff2b-complete-race' and wait_event_type='Lock'",v=>Number(v)===1);
  await h.pending;assert.equal((await pendingCancel).state,'succeeded');assert.equal(await state(finished.runId),'succeeded');
  results.push({test:'cancellation/checkpoint lock order exercised both ways; terminal success immutable',pass:true});
  const preserved=await sql('select md5(string_agg(to_jsonb(r)::text,\'\' order by id)) from public.ff_runs r');
  await sql(readFileSync(join(root,'supabase','operations','phase2b_disable_execution.sql'),'utf8'));
  await assert.rejects(()=>start('off'),/permission denied/);await assert.rejects(()=>claim(),/permission denied/);
  assert.equal(await sql('select md5(string_agg(to_jsonb(r)::text,\'\' order by id)) from public.ff_runs r'),preserved);
  assert.ok(await auth("select public.ff_load()"));assert.ok(await auth("select public.ff_exec_read('history')"));
  await sql(readFileSync(join(root,'supabase','operations','phase2b_enable_execution.sql'),'utf8'));assert.equal((await start('complete-first')).replayed,true);
  results.push({test:'disable/re-enable denies direct RPC, preserves rows, workspace reads and idempotency',pass:true});
  if(process.env.FLOWFORGE_TEST_DELIVERY==='1') {
    const deliveryMigration='20261019134354_phase2c_delivery.sql';
    const deliveryDir=await workdir('phase2c',[...names,deliveryMigration]);
    assert.equal((await migrate('ff2b',deliveryDir)).code,0);
    deliveryInstalled=true;
    assert.equal(await sql('select count(*) from supabase_migrations.schema_migrations'),'4');
    await assert.rejects(()=>service(`select public.ff_delivery_claim('${worker}',1)`),/permission denied/);
    await sql(readFileSync(join(root,'supabase','operations','phase2c_enable_delivery.sql'),'utf8'));
    await clear(); const a=await start('dispatch-a'),b=await start('dispatch-b');
    const dc=(who,app='ff2c-dispatch')=>service(`select public.ff_delivery_claim('${who}',1)`,app).then(json);
    const ds=(c,who,outcome='published')=>service(`select public.ff_delivery_settle(${c.eventId},'${who}',${c.generation},'${outcome}',${outcome==='published'?"'synthetic-message'":'null'})`).then(s=>{assert.ok(['t','f'].includes(s));return s==='t';});
    const rc=(rid,eid,who,app='ff2c-worker')=>service(`select public.ff_delivery_run_claim('${rid}',${eid},'${who}')`,app).then(json);
    let claimed=await Promise.all([dc(worker,'ff2c-dispatch-a'),dc(replacement,'ff2c-dispatch-b')]);
    assert.equal(claimed[0].length,1);assert.equal(claimed[1].length,1);assert.notEqual(claimed[0][0].eventId,claimed[1][0].eventId);
    assert.equal(await sql("select count(*) from flowforge_private.ff_delivery_attempts where outcome='publishing'"),'2');
    results.push({test:'Phase 2C independent dispatchers exclusively claim distinct outbox rows',pass:true});
    const old=claimed[0][0];await sql(`update flowforge_private.ff_execution_outbox set dispatch_until=clock_timestamp()-interval '1 second' where id=${old.eventId}`);
    const fresh=(await dc(replacement))[0];assert.equal(fresh.eventId,old.eventId);assert.equal(fresh.generation,old.generation+1);
    assert.equal(await ds(old,worker),false);assert.equal(await ds(fresh,replacement),true);
    results.push({test:'Phase 2C independent-session abandoned publication recovery and stale dispatcher fencing',pass:true});
    const eid=await sql(`select id from flowforge_private.ff_execution_outbox where run_id='${a.runId}' and event='ready'`);
    const workers=await Promise.all([rc(a.runId,eid,worker,'ff2c-worker-a'),rc(a.runId,eid,replacement,'ff2c-worker-b')]);
    assert.equal(workers.filter(c=>c.status==='claimed').length,1);assert.equal(workers.filter(c=>c.status==='busy').length,1);
    const c=workers.find(c=>c.status==='claimed'),who=workers[0].status==='claimed'?worker:replacement;
    await advance(c,false,0,who);await advance(c,true,0,who);
    await sql(`update public.ff_runs set lease_until=clock_timestamp()-interval '1 second' where id='${a.runId}'`);
    const recovered=await rc(a.runId,eid,replacement);assert.equal(recovered.checkpoint,1);assert.equal(recovered.generation,c.generation+1);
    await assert.rejects(()=>advance(c,true,1,who),/lease lost/);
    await advance(recovered,false,1,replacement);await advance(recovered,true,1,replacement);
    assert.equal(await state(a.runId),'succeeded');
    assert.equal(await sql(`select count(*) from public.ff_run_steps where run_id='${a.runId}' and node_id='a' and state='succeeded'`),'1');
    results.push({test:'Phase 2C targeted concurrent workers and fenced crash recovery preserve committed checkpoints',pass:true});
    // Hold cancellation's run lock while a targeted worker waits in a different backend.
    const eidB=await sql(`select id from flowforge_private.ff_execution_outbox where run_id='${b.runId}' and event='ready'`);
    const cancelHold=await hold(`select public.ff_exec_cancel('${b.runId}')`,'authenticated');
    const waiting=rc(b.runId,eidB,worker,'ff2c-cancel-race');
    await until("select count(*) from pg_stat_activity where application_name='ff2c-cancel-race' and wait_event_type='Lock'",v=>Number(v)===1);
    await cancelHold.pending;assert.equal((await waiting).status,'terminal');
    results.push({test:'Phase 2C cancellation wins contended targeted worker acquisition without execution',pass:true});
  }
  const report={postgres:await sql('select version()'),cli:'2.121.0',migration:names[2],sha256:createHash('sha256').update(readFileSync(join(root,'supabase','migrations',names[2]))).digest('hex'),host:'127.0.0.1',port,results};
  writeFileSync(join(evidence,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({evidence,results},null,2));
} catch(error) {
  writeFileSync(join(evidence,'failure.json'),JSON.stringify({results,error:String(error)},null,2));throw error;
} finally {
  if(started){
    await checked(join(bin,'pg_ctl.exe'),['stop','-D',data,'-m','fast','-W']);
    if(server.exitCode===null&&server.signalCode===null)await new Promise((ok,fail)=>{
      const timer=setTimeout(()=>fail(Error('Disposable PostgreSQL shutdown not confirmed; inspect its retained log')),15000);
      server.once('exit',()=>{clearTimeout(timer);ok();});
    });
  }
}
