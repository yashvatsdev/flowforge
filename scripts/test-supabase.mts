/** TEST ONLY: local Auth REST fixture + real PostgreSQL migration engine.
 * No OAuth provider or production authentication is bypassed by application code.
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readdirSync,readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db=new PGlite();
await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
for (const migration of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${migration}`,"utf8"));
// Test-only explicit opt-in; hosted migration defaults to admission/workers off.
await db.exec(readFileSync('supabase/operations/phase2b_enable_execution.sql','utf8'));
const grants=new Map<string,string>();
function fixtureSession() {
  const id="11111111-1111-4111-8111-111111111111";
  const claims={sub:id,aud:"authenticated",role:"authenticated",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,amr:[{method:"oauth",timestamp:Math.floor(Date.now()/1000)}],email:"1@example.com",app_metadata:{provider:"google"},user_metadata:{name:"Test user 1"}};
  const access_token=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify(claims)).toString("base64url"),Buffer.from("fixture-signature").toString("base64url")].join(".");
  return {access_token,refresh_token:"fixture",expires_in:3600,expires_at:claims.exp,token_type:"bearer",user:{id,email:claims.email,app_metadata:claims.app_metadata,user_metadata:claims.user_metadata,identities:[{provider:"google"}],created_at:new Date().toISOString()}};
}
let serial=Promise.resolve();
const server=createServer((req,res)=>{
  serial=serial.then(async()=>{
    const respond=(status:number,value:unknown)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value));};
    if(req.url==='/health')return respond(200,{fixture:true});
    const target=new URL(req.url||"/","http://fixture");
    if(target.pathname==="/auth/v1/authorize") {
      const redirect=target.searchParams.get("redirect_to")||"";
      if(!redirect.startsWith("http://localhost:43821/auth/callback")||target.searchParams.get("provider")!=="google")return respond(400,{});
      const code=randomUUID();grants.set(code,target.searchParams.get("code_challenge")||"");
      const callback=new URL(redirect);callback.searchParams.set("code",code);res.writeHead(302,{Location:callback.href});res.end();return;
    }
    if(target.pathname==="/auth/v1/token") {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
      if(target.searchParams.get("grant_type")==="refresh_token"&&body.refresh_token==="fixture")return respond(200,fixtureSession());
      const expected=grants.get(body.auth_code);grants.delete(body.auth_code);
      if(!expected||createHash("sha256").update(body.code_verifier||"").digest("base64url")!==expected)return respond(400,{message:"Invalid or replayed code",error_code:"bad_code_verifier"});
      return respond(200,fixtureSession());
    }
    const token=req.headers.authorization?.replace('Bearer ','');let claims:Record<string,unknown>={};
    try{claims=JSON.parse(Buffer.from(token?.split('.')[1]||'',"base64url").toString());}catch{}
    // TEST ONLY service credential for the loopback runner integration. Production
    // code has no fixture bypass; only these two worker RPCs are available here.
    if(token==='fixture-execution-service'&&target.pathname.startsWith('/rest/v1/rpc/')) {
      await db.exec('reset role;set role service_role');
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
      try {
        let output:unknown;
        if(target.pathname==='/rest/v1/rpc/ff_exec_claim')output=(await db.query<{v:unknown}>('select public.ff_exec_claim($1::uuid) as v',[body.worker])).rows[0].v;
        else if(target.pathname==='/rest/v1/rpc/ff_exec_advance')output=(await db.query<{v:unknown}>('select public.ff_exec_advance($1::uuid,$2::uuid,$3::bigint,$4::boolean,$5::integer) as v',[body.rid,body.worker,body.fence,body.complete,body.checkpoint])).rows[0].v;
        else return respond(403,{message:'Fixture worker RPC denied'});
        return respond(200,output);
      }catch {return respond(409,{message:'Fixture worker RPC failed'});}
    }
    if(!['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'].includes(String(claims.sub)))return respond(401,{message:"Not authenticated"});
    const user={id:claims.sub,aud:"authenticated",role:"authenticated",email:claims.email,app_metadata:claims.app_metadata,user_metadata:claims.user_metadata,identities:[{provider:(claims.app_metadata as Record<string,unknown>)?.provider}],created_at:new Date().toISOString()};
    if(req.url?.startsWith('/auth/v1/user'))return respond(200,user);
    if(req.url?.startsWith('/auth/v1/logout'))return respond(200,{});
    await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role authenticated');
    try {
      let output:unknown;
      if(req.url?.startsWith('/rest/v1/rpc/')){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
        const name=req.url.split('/').pop();
        if(name==='ff_bootstrap')output=(await db.query<{v:unknown}>('select public.ff_bootstrap() as v')).rows[0].v;
        else if(name==='ff_load')output=(await db.query<{v:unknown}>('select public.ff_load() as v')).rows[0].v;
        else if(name==='ff_commit')output=(await db.query<{v:unknown}>('select public.ff_commit($1,$2::jsonb,$3,$4) as v',[body.expected,JSON.stringify(body.document),body.import_fingerprint,body.action])).rows[0].v;
        else if(name==='ff_exec_start')output=(await db.query<{v:unknown}>('select public.ff_exec_start($1,$2,$3::jsonb,$4) as v',[body.workflow,body.expected,JSON.stringify(body.input),body.key])).rows[0].v;
        else if(name==='ff_exec_read')output=(await db.query<{v:unknown}>('select public.ff_exec_read($1,$2::uuid,$3::uuid) as v',[body.kind,body.rid??null,body.before_id??null])).rows[0].v;
        else if(name==='ff_exec_cancel')output=(await db.query<{v:unknown}>('select public.ff_exec_cancel($1::uuid) as v',[body.rid])).rows[0].v;
        else return respond(404,{});
      }else if(req.url?.startsWith('/rest/v1/ff_imports')){
        const url=new URL(req.url,'http://fixture');output=(await db.query('select fingerprint from public.ff_imports where workspace_id=$1 and fingerprint=$2',[url.searchParams.get('workspace_id')?.replace('eq.',''),url.searchParams.get('fingerprint')?.replace('eq.','')])).rows;
      }else return respond(404,{});
      respond(200,output);
    }catch(e){const error=e as {code?:string;message:string};respond(error.code==='42501'?403:error.code==='PT409'?409:400,{code:error.code,message:error.message});}
  }).catch(()=>{res.writeHead(500);res.end('{"error":"Fixture failure"}');});
});
server.listen(18181,'127.0.0.1',()=>console.log('Local Supabase test fixture ready'));
