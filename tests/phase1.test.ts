import { test } from "node:test";
import assert from "node:assert/strict";
import { safeDestination, googleIdentity, sameOrigin } from "../src/lib/auth-policy";
import { RevisionWriter, SaveError } from "../src/lib/revision-writer";
import { mergeImport, boundedJson } from "../src/lib/persistence";
import { starter } from "../src/lib/seeds";
import type { State } from "../src/lib/workspace";
const state=():State=>({version:1,workflows:[starter()],executions:[],settings:{name:"User",email:"u@example.com",workspace:"Mine",reduceMotion:false}});
test("OAuth destinations reject external, protocol-relative and escaped redirects",()=>{
  for(const value of ["https://evil.test","//evil.test","/\\evil.test","/dashboard\\@evil.test","/login","/dashboard\r\nLocation: evil"])assert.equal(safeDestination(value),"/dashboard");
  assert.equal(safeDestination("/workflows/order-intake"),"/workflows/order-intake");
});
test("only verified Google identity is eligible; user metadata cannot grant access",()=>{
  assert.equal(googleIdentity(null),false);assert.equal(googleIdentity({app_metadata:{provider:"email"},identities:[{provider:"google"}]}),false);
  assert.equal(googleIdentity({app_metadata:{provider:"google"},identities:[{provider:"google"}]}),true);
});
test("cookie authenticated mutations require exact application Origin",()=>{
  process.env.APP_ORIGIN="http://localhost:3001";
  assert.equal(sameOrigin(new Request("http://localhost:3001/api/workspace",{headers:{Origin:"http://localhost:3001"}})),true);
  assert.equal(sameOrigin(new Request("http://localhost:3001/api/workspace",{headers:{Origin:"https://evil.test"}})),false);
  assert.equal(sameOrigin(new Request("http://localhost:3001/api/workspace")),false);
});
test("serial saves use acknowledged revisions; failure retains draft and retry resumes",async()=>{
  const revisions:number[]=[];let fail=true;
  const writer=new RevisionWriter(async (_s,rev)=>{revisions.push(rev);if(fail){fail=false;throw new SaveError("offline");}return rev+1;});
  await assert.rejects(writer.enqueue(state()),/offline/);assert.equal(writer.status,"error");assert.equal(writer.tasks.length,1);
  await writer.flush();assert.equal(writer.status,"saved");assert.equal(writer.revision,1);
  await Promise.all([writer.enqueue(state()),writer.enqueue(state())]);assert.deepEqual(revisions,[0,0,1,2]);
});
test("conflicting save is preserved and never silently retried",async()=>{
  let sends=0;const writer=new RevisionWriter(async()=>{sends++;throw new SaveError("conflict",409);});
  await assert.rejects(writer.enqueue(state()));await assert.rejects(writer.enqueue(state()));
  assert.equal(writer.status,"conflict");assert.equal(writer.tasks.length,2);assert.equal(sends,1);
});
test("local import adds copies without overwriting existing workflows/settings",()=>{
  const current=state(),incoming=state();let id=0;const merged=mergeImport(current,incoming,()=>`copy-${++id}`);
  assert.equal(merged.workflows.length,2);assert.equal(merged.workflows[0].id,current.workflows[0].id);assert.notEqual(merged.workflows[1].id,current.workflows[0].id);
  assert.deepEqual(merged.settings,current.settings);assert.equal(current.workflows.length,1);
});
test("request bodies reject non-JSON, oversized and malformed documents",async()=>{
  await assert.rejects(()=>boundedJson(new Request("https://local",{method:"POST",body:"bad"})));
  await assert.rejects(()=>boundedJson(new Request("https://local",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"})));
  await assert.rejects(()=>boundedJson(new Request("https://local",{method:"POST",headers:{"Content-Type":"application/json"},body:'"'+"x".repeat(5_000_000)+'"'})));
});

test("corrected draft supersedes an invalid failed snapshot and can save",async()=>{
  let fail=true;const sent:State[]=[];const writer=new RevisionWriter(async(doc,rev)=>{sent.push(doc);if(fail){fail=false;throw new SaveError("invalid",422);}return rev+1;});
  const broken=state();broken.workflows[0].nodes[0].data.config.amount="";await assert.rejects(writer.enqueue(broken));
  await writer.enqueue(state());assert.equal(writer.status,"saved");assert.equal(sent[1].workflows[0].nodes[0].data.config.amount,"149");
});
