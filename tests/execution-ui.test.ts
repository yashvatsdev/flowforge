import { test } from "node:test";
import assert from "node:assert/strict";
import { manualInput, StartIntent, ExecutionRequestError } from "../src/lib/execution/browser-client";
import { redactValue, terminalRun, duration, displaySteps, displayDetails } from "../src/lib/execution/presentation";
import { localExecutionUI } from "../src/lib/execution/ui-capability";
import { pollingLoop } from "../src/lib/execution/polling";

test("manual input requires a bounded object", () => {
  assert.deepEqual(manualInput('{"amount":2}'), { amount: 2 });
  for (const raw of ['null','[]','false','{','"text"',JSON.stringify({ x:'a'.repeat(65536) })]) assert.throws(() => manualInput(raw));
});
test("ambiguous start retries preserve exact body and key", async () => {
  const original = global.fetch; const requests: RequestInit[] = [];
  global.fetch = async (_url, init) => { requests.push(init!); if (requests.length === 1) throw new Error('network'); return Response.json({ runId:'test',state:'queued' }); };
  try { const intent = new StartIntent(7,{amount:4}); await assert.rejects(intent.send('workflow')); await intent.send('workflow'); assert.equal(requests[0].body,requests[1].body); assert.deepEqual(requests[0].headers,requests[1].headers); }
  finally { global.fetch = original; }
});
test("execution errors never echo private server messages", () => {
  for (const status of [401,403,404,409,422,429,503,500]) assert.ok(new ExecutionRequestError(status).message.length > 10);
});
test("execution presentation strips credentials and private step metadata", () => {
  assert.deepEqual(redactValue({ nested:{apiKey:'private', amount:3},jwt:'Bearer secret' }),{nested:{apiKey:'[Redacted]',amount:3},jwt:'[Redacted]'});
  const steps=displaySteps([{node_id:'a',ordinal:0,attempt:1,state:'succeeded',output:{password:'x'},error_code:null,started_at:'today',finished_at:null,generation:99} as Parameters<typeof displaySteps>[0][number]]);
  assert.equal('generation' in steps[0],false);assert.deepEqual(steps[0].output,{password:'[Redacted]'});
  assert.ok(terminalRun('cancelled'));assert.ok(!terminalRun('cancellation_requested'));assert.equal(duration({started_at:null,finished_at:null}),'Not started');
});
test("local execution UI cannot be enabled against hosted or production targets", () => {
  const env={FLOWFORGE_EXECUTION_UI_ENABLED:'local',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:18181',NODE_ENV:'test'};
  assert.equal(localExecutionUI(env),true);assert.equal(localExecutionUI({...env,NODE_ENV:'production'}),false);assert.equal(localExecutionUI({...env,NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co'}),false);assert.equal(localExecutionUI({}),false);
});
test("details DTO excludes raw workflow configuration and worker authority", () => {
  const raw={id:'run',workflow_id:'workflow',workspace_revision:2,state:'queued' as const,created_at:'today',started_at:null,finished_at:null,error_code:null,worker_id:'private-worker',generation:9,workspace_id:'private-workspace',manual_input:{nested:{token:'private-input'}},snapshot:{id:'workflow',name:'Saved workflow',nodes:[{id:'node',data:{label:'Start',kind:'trigger',config:{password:'private-config'}}}]}};
  const result=displayDetails(raw),text=JSON.stringify(result);
  assert.equal(result.snapshot.id,'workflow');assert.equal('generation' in result,false);assert.equal('workspace_id' in result,false);assert.ok(!text.includes('private-'));assert.ok(text.includes('[Redacted]'));
});
test("polling has no overlapping requests and stops terminal/hidden/unmounted work", async () => {
  let visible=true,calls=0,resolve!: (value:boolean)=>void; let next: (()=>void)|undefined;
  const loop=pollingLoop(async signal=>{calls++;return new Promise<boolean>(r=>{resolve=r;signal.addEventListener('abort',()=>r(true));});},{visible:()=>visible,schedule:((fn:()=>void)=>{next=fn;return 1;}) as unknown as typeof setTimeout,unschedule:()=>{next=undefined;}});
  loop.start();loop.start();assert.equal(calls,1);visible=false;loop.visibilityChanged();await new Promise(r=>setImmediate(r));assert.equal(next,undefined);visible=true;loop.visibilityChanged();assert.equal(calls,2);resolve(false);await new Promise(r=>setImmediate(r));loop.visibilityChanged();assert.equal(calls,2);loop.stop();assert.equal(next,undefined);
});
