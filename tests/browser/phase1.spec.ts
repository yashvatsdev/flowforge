import { test,expect,type BrowserContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
test("background ingress stays disabled without explicit local configuration", async({request})=>{
  for(const path of ['/api/internal/execution-worker','/api/internal/execution-maintenance']){
    const response=await request.post(path,{data:{version:1},headers:{'upstash-signature':'forged'}});
    expect(response.status()).toBe(503);expect(await response.text()).toBe('');
  }
});
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
test("real execution UI: input validation, ambiguous retry, details, cancellation and responsive history",async({page,context})=>{
  await login(context,'33333333-3333-4333-8333-333333333333');
  const origin={Origin:'http://localhost:43821'};
  const state=await(await context.request.get('/api/workspace')).json();
  const id=`ui-${crypto.randomUUID()}`;
  const workflow={id,name:'Real UI regression',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'manual',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Manual start',config:{amount:'1',email:''}}}],edges:[]};
  expect((await context.request.post('/api/workflows',{headers:origin,data:{revision:state.revision,workflow}})).status()).toBe(200);
  await page.goto(`/workflows/${id}`);
  const runButton=page.getByRole('button',{name:'Run Workflow',exact:true});await expect(runButton).toBeEnabled();await runButton.click();
  await page.getByRole('textbox',{name:/Manual input/}).fill('[]');await page.getByRole('button',{name:'Start real run',exact:true}).click();await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('JSON object');
  await page.getByRole('textbox',{name:/Manual input/}).fill('{"amount":7,"password":"never-display"}');
  const keys:string[]=[];let lost=false;
  await page.route(`**/api/workflows/${id}/runs`,async route=>{keys.push(route.request().headers()['idempotency-key']);if(!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();});
  await page.getByRole('button',{name:'Start real run',exact:true}).click();await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Connection interrupted');
  await page.getByRole('button',{name:'Retry same request'}).click();await expect(page).toHaveURL(/\/executions\?run=/);
  expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Real execution details'})).toBeVisible();await expect(dialog.getByText('Real UI regression',{exact:true})).toBeVisible();
  await dialog.getByText('Manual input (sensitive fields redacted)').click();await expect(dialog.locator('pre')).toContainText('[Redacted]');await expect(dialog).not.toContainText('never-display');
  await dialog.getByRole('button',{name:'Cancel execution',exact:true}).click();await expect(dialog.locator('.real-status')).toHaveText('Cancelled');
  await dialog.getByRole('button',{name:'Close dialog'}).click();
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await expect(page.getByRole('heading',{name:'Executions',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.phase2b-evidence/phase2d-history-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Local simulations',exact:true}).click();await expect(page).toHaveURL(/view=simulation/);
  const saved=await(await context.request.get('/api/workspace')).json();
  const started=await context.request.post(`/api/workflows/${id}/runs`,{headers:{...origin,'Idempotency-Key':crypto.randomUUID()},data:{expectedRevision:saved.revision,input:{amount:9}}});expect(started.status()).toBe(200);const completedId=(await started.json()).runId;
  await promisify(execFile)(process.execPath,['--import','tsx','scripts/run-executions.mts'],{env:{...process.env,NODE_ENV:'test',FLOWFORGE_RUNNER_URL:'http://127.0.0.1:18181',FLOWFORGE_RUNNER_SERVICE_KEY:'fixture-execution-service'},timeout:15000});
  await page.goto(`/executions?run=${completedId}`);const completed=page.getByRole('dialog');await expect(completed.locator('.real-status').first()).toHaveText('Completed');await expect(completed.getByRole('heading',{name:'Manual start · attempt 1'})).toBeVisible();await completed.getByText('Output (sensitive fields redacted)').click();await expect(completed.locator('pre').last()).toContainText('9');await expect(completed.getByRole('button',{name:'Cancel execution',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:'.phase2b-evidence/phase2d-details-390.png',fullPage:true});expect(await completed.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.goto('/dashboard');for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await expect(page.getByRole('heading',{name:'Recent real executions'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.phase2b-evidence/phase2d-dashboard-${width}.png`,fullPage:true});}
});
test("real history shows retry and expired-session feedback without leaking errors",async({page,context})=>{
  await login(context,'33333333-3333-4333-8333-333333333333');let expired=false;
  await page.route('**/api/executions',async route=>{await route.fulfill({status:expired?401:503,json:{error:'private-service-secret'}});});
  await page.goto('/executions');await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('disabled or temporarily unavailable');expired=true;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('link',{name:'Sign in again'})).toBeVisible();await expect(page.locator('body')).not.toContainText('private-service-secret');
});
test("real start revision conflict and disabled backend do not report success",async({page,context})=>{
  await login(context,'33333333-3333-4333-8333-333333333333');const state=await(await context.request.get('/api/workspace')).json();const id=`conflict-${crypto.randomUUID()}`;
  const workflow={id,name:'Revision conflict',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'manual',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'1',email:''}}}],edges:[]};
  expect((await context.request.post('/api/workflows',{headers:{Origin:'http://localhost:43821'},data:{revision:state.revision,workflow}})).status()).toBe(200);
  await page.goto(`/workflows/${id}`);
  let disabled=false;await page.route(`**/api/workflows/${id}/runs`,route=>route.fulfill({status:disabled?503:409,json:{error:'internal'}}));
  await page.getByRole('button',{name:'Run Workflow',exact:true}).click();await page.getByRole('button',{name:'Start real run',exact:true}).click();await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('workspace changed');await expect(page).toHaveURL(new RegExp(`workflows/${id}`));
  disabled=true;await page.getByRole('button',{name:'Retry same request'}).click();await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Real execution is disabled');await expect(page).toHaveURL(new RegExp(`workflows/${id}`));
});
test("real history cursor pagination and terminal polling lifecycle",async({page,context})=>{
  await login(context,'33333333-3333-4333-8333-333333333333');await page.clock.install();
  const rid='44444444-4444-4444-8444-444444444444',next='55555555-5555-4555-8555-555555555555';
  const run={id:rid,workflow_id:'mock',workspace_revision:1,state:'queued',created_at:'2026-10-19T00:00:00Z',started_at:null,finished_at:null,error_code:null};
  let details=0,history=0,done=false;const cursors:(string|null)[]=[];
  await page.route('**/api/executions?*',async route=>{
    const cursor=new URL(route.request().url()).searchParams.get('cursor');cursors.push(cursor);await route.fulfill({json:{runs:[],nextCursor:null}});
  });
  await page.route('**/api/executions',async route=>{history++;await route.fulfill({json:{runs:[{...run,state:'succeeded'}],nextCursor:next}});});
  await page.route(`**/api/executions/${rid}`,async route=>{details++;await route.fulfill({json:{...run,state:done?'succeeded':'queued',snapshot:{id:'mock',name:'Polling lifecycle',nodes:[]},manual_input:{}}});});
  await page.route(`**/api/executions/${rid}/steps`,route=>route.fulfill({json:[]}));
  await page.goto('/executions');await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Page 2 · up to 25 runs')).toBeVisible();expect(cursors).toEqual([next]);await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByText('Page 1 · up to 25 runs')).toBeVisible();
  await page.getByRole('link',{name:`View run ${rid}`}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.real-status')).toHaveText('Queued');done=true;await page.clock.runFor(5100);await expect(dialog.locator('.real-status')).toHaveText('Completed');const terminalCalls=details,historyCalls=history;await page.clock.runFor(20000);expect(details).toBe(terminalCalls);expect(history).toBe(historyCalls);await dialog.getByRole('button',{name:'Close dialog'}).click();await page.clock.runFor(10000);expect(details).toBe(terminalCalls);
});
for(const [name,raw] of [["corrupt JSON","{original broken"],["unsupported version",'{"version":999,"original":"keep"}'],["malformed schema",'{"version":1,"workflows":[{}]}']])test(`local ${name}: preserves, exports and confirms recovery`,async({page})=>{
  await page.addInitScript(raw=>{if(!sessionStorage.getItem('recovery-seeded')){localStorage.setItem('flowforge:v1',raw);sessionStorage.setItem('recovery-seeded','yes');}},raw);
  // The public local workspace owns legacy recovery; protected studio routes use the account workspace.
  await page.goto('/');await expect(page.getByRole('heading',{name:'Your workspace needs recovery'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('flowforge:v1'))).toBe(raw);
  await page.reload();await expect(page.getByRole('heading',{name:'Your workspace needs recovery'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('flowforge:v1'))).toBe(raw);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export preserved data'}).click();
  const stream=await(await downloadEvent).createReadStream();const chunks=[];for await(const chunk of stream!)chunks.push(chunk);expect(Buffer.concat(chunks).toString()).toBe(raw);
  await page.getByRole('button',{name:'Reset workspace',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('flowforge:v1'))).toBe(raw);
  await page.getByRole('button',{name:'Reset workspace',exact:true}).click();await page.getByRole('button',{name:'Confirm reset',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your workspace needs recovery'})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('flowforge:recovery'))).toBe(raw);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('flowforge:v1')!).version)).toBe(1);
});
async function login(context:BrowserContext,id=a,provider="google",expired=false){
  const claims={sub:id,amr:[{method:provider==="google"?"oauth":"password"}],aud:"authenticated",role:"authenticated",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+(expired?-600:3600),email:`${id[0]}@example.com`,app_metadata:{provider},user_metadata:{name:`Test user ${id[0]}`}};
  const token=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString('base64url'),Buffer.from(JSON.stringify(claims)).toString('base64url'),Buffer.from('fixture-signature').toString('base64url')].join('.');
  const session={access_token:token,refresh_token:'fixture',expires_at:claims.exp,expires_in:3600,token_type:'bearer',user:{id,email:claims.email,app_metadata:claims.app_metadata,user_metadata:claims.user_metadata}};
  await context.addCookies([{name:"sb-127-auth-token",value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'localhost',path:'/'}]);
}
test("public sign-in, protected pages/APIs, callback errors, and CSRF denial",async({page,request})=>{
  await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
  expect((await request.get('/api/workspace')).status()).toBe(401);
  expect((await request.put('/api/workspace',{data:{},headers:{Origin:'https://evil.test'}})).status()).toBe(403);
  await page.goto('/auth/callback?code=invalid&next=https://evil.test');await expect(page).toHaveURL(/\/login\?error=callback/);
  await page.goto('/?error=invalid_request&error_code=bad_oauth_state&error_description=untrusted');
  await expect(page).toHaveURL(/\/login\?error=callback$/);
  await expect(page.locator('p[role="alert"]')).toContainText('canceled or expired');
});
test("Google fixture identity loads workspace and sign-out protects it again",async({page,context})=>{
  await login(context);await page.goto('/dashboard');await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
  await expect(page.getByText('Private cloud workspace',{exact:true})).toBeVisible();
  await expect(page.locator('.app-footer')).toContainText('Cloud storage');
  await expect(page.locator('.chart-empty a')).toHaveAttribute('href','/templates');
  await page.locator('.account-menu summary').click();await expect(page.getByText('1@example.com',{exact:true})).toBeVisible();
  await page.locator('.account-menu').getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login/);await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);
});

for(const viewport of [{width:1536,height:786},{width:1280,height:600},{width:390,height:700}])test(`sign-out stays reachable at ${viewport.width}x${viewport.height}`,async({page,context})=>{
  await login(context);await page.setViewportSize(viewport);await page.goto('/settings');
  const signout=page.locator('.app-topbar').getByRole('button',{name:'Sign out',exact:true});await expect(signout).toBeVisible();
  const topBox=await signout.boundingBox();expect(topBox).not.toBeNull();expect(topBox!.y+topBox!.height).toBeLessThanOrEqual(viewport.height);expect(topBox!.x+topBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(viewport.width>760){
    const summary=page.locator('.account-menu summary');await summary.scrollIntoViewIfNeeded();await summary.click();
    const menuSignout=page.locator('.account-menu').getByRole('button',{name:'Sign out',exact:true});await expect(menuSignout).toBeVisible();
    const menuBox=await menuSignout.boundingBox();expect(menuBox!.y).toBeGreaterThanOrEqual(0);expect(menuBox!.y+menuBox!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({path:`.phase1-evidence/logout-menu-${viewport.width}x${viewport.height}.png`});
    await page.mouse.click(menuBox!.x+menuBox!.width/2,menuBox!.y+menuBox!.height/2);
  }else await signout.click();
  await expect(page).toHaveURL(/\/login/);await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);
});
test("non-Google fixture user is denied",async({page,context})=>{await login(context,a,'email');await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);});

test("durable execution API authentication, saved provenance, idempotency, isolation and cancellation",async({browser,request})=>{
  expect((await request.get('/api/executions')).status()).toBe(401);
  const first=await browser.newContext(),second=await browser.newContext();
  try {
    await login(first);await login(second,b);
    await second.request.get('/api/workspace');
    const origin={Origin:'http://localhost:43821'};
    const state=await(await first.request.get('/api/workspace')).json();
    const workflow={id:'durable-api',name:'Durable API',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'manual',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'1',email:''}}}],edges:[]};
    const saved=await first.request.post('/api/workflows',{headers:origin,data:{revision:state.revision,workflow}});
    expect(saved.status()).toBe(200);const expectedRevision=(await saved.json()).revision;
    const path='/api/workflows/durable-api/runs',headers={...origin,'Idempotency-Key':'browser-durable'};
    expect((await first.request.post(path,{headers:{...headers,Origin:'https://evil.test'},data:{expectedRevision,input:{}}})).status()).toBe(403);
    expect((await first.request.post(path,{headers:origin,data:{expectedRevision,input:{}}})).status()).toBe(422);
    expect((await first.request.post(path,{headers,data:{expectedRevision,input:{},graph:workflow}})).status()).toBe(422);
    const response=await first.request.post(path,{headers,data:{expectedRevision,input:{amount:12}}});
    expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
    const run=await response.json();expect(run.state).toBe('queued');
    const replay=await first.request.post(path,{headers,data:{expectedRevision,input:{amount:12}}});
    expect((await replay.json()).runId).toBe(run.runId);
    expect((await first.request.post(path,{headers,data:{expectedRevision,input:{amount:13}}})).status()).toBe(409);
    const details=await first.request.get(`/api/executions/${run.runId}`);expect(details.status()).toBe(200);
    expect((await details.json()).snapshot.id).toBe(workflow.id);
    expect((await(await first.request.get(`/api/executions/${run.runId}/steps`)).json())).toEqual([]);
    expect((await second.request.get(`/api/executions/${run.runId}`)).status()).toBe(404);
    expect((await second.request.post(`/api/executions/${run.runId}/cancel`,{headers:origin})).status()).toBe(404);
    expect((await second.request.post(path,{headers:{...origin,'Idempotency-Key':'foreign'},data:{expectedRevision:0,input:{}}})).status()).toBe(404);
    const cancelled=await first.request.post(`/api/executions/${run.runId}/cancel`,{headers:origin});expect(cancelled.status()).toBe(200);expect((await cancelled.json()).state).toBe('cancelled');
    const queued=await first.request.post(path,{headers:{...headers,'Idempotency-Key':'browser-worker'},data:{expectedRevision,input:{amount:12}}});
    expect(queued.status()).toBe(200);const workerRun=await queued.json();
    const workerProcess=await promisify(execFile)(process.execPath,['--import','tsx','scripts/run-executions.mts'],{env:{...process.env,NODE_ENV:'test',FLOWFORGE_RUNNER_URL:'http://127.0.0.1:18181',FLOWFORGE_RUNNER_SERVICE_KEY:'fixture-execution-service'},timeout:15000});
    expect(workerProcess.stdout).toContain('Local execution drain finished: 1 runs');
    expect((await(await first.request.get(`/api/executions/${workerRun.runId}`)).json()).state).toBe('succeeded');
    const steps=await(await first.request.get(`/api/executions/${workerRun.runId}/steps`)).json();
    expect(steps).toHaveLength(1);expect(steps[0].output).toEqual({amount:12});
    expect((await(await first.request.get('/api/executions')).json()).runs.some((r:{id:string})=>r.id===run.runId)).toBe(true);
    expect((await first.request.get('/api/executions/not-a-uuid')).status()).toBe(400);
  } finally {await first.close();await second.close();}
});
test("API CRUD, revision conflicts and two-user workspace isolation",async({browser})=>{
  const first=await browser.newContext(),second=await browser.newContext();await login(first);await login(second,b);
  const origin={Origin:'http://localhost:43821'};
  const initial=await(await first.request.get('/api/workspace')).json();
  const workflow={id:'api-workflow',name:'API test',description:'Saved by API',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'trigger',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'10',email:'test@example.com'}}}],edges:[]};
  const created=await first.request.post('/api/workflows',{headers:origin,data:{workflow,revision:initial.revision}});expect(created.status()).toBe(200);let rev=(await created.json()).revision;
  expect((await second.request.get('/api/workflows/api-workflow')).status()).toBe(404);
  const updated=await first.request.put('/api/workflows/api-workflow',{headers:origin,data:{workflow:{...workflow,name:'Edited API'},revision:rev}});expect(updated.status()).toBe(200);rev=(await updated.json()).revision;
  expect((await first.request.put('/api/workflows/api-workflow',{headers:origin,data:{workflow,revision:initial.revision}})).status()).toBe(409);
  expect((await first.request.get('/api/workflows/api-workflow')).status()).toBe(200);
  expect((await second.request.delete('/api/workflows/api-workflow',{headers:origin,data:{revision:0}})).status()).toBe(404);
  expect((await first.request.delete('/api/workflows/api-workflow',{headers:origin,data:{revision:rev}})).status()).toBe(200);
  await first.close();await second.close();
});
for(const width of [1440,768,390])test(`Settings no overflow at ${width}px with authenticated persistence`,async({page,context})=>{
  await login(context);await page.setViewportSize({width,height:1000});await page.goto('/settings');await expect(page.getByRole('button',{name:'Export workspace',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('input[type=file]')).toBeHidden();
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import workspace',exact:true}).click();await chooser;
});
test("node selection, connection, database autosave, refresh and simulation",async({page,context})=>{
  await login(context);await page.goto('/workflows');await page.getByRole('button',{name:'New workflow',exact:true}).click();await page.getByLabel('Workflow name').fill('Cloud editor regression');await page.getByRole('button',{name:'Create workflow'}).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);await page.locator('.palette-node[data-node-kind=transform]').click();const inspect=page.getByRole('combobox',{name:'Inspect node',exact:true});const target=await inspect.inputValue();await inspect.selectOption('n0');await expect(page.locator('.react-flow__node[data-id=n0]')).toHaveClass(/selected/);await page.getByRole('combobox',{name:'Connect to',exact:true}).selectOption(target);await page.getByRole('button',{name:'Connect nodes'}).click();
  await expect(page.locator('.canvas-badge')).toContainText('1 connections');await page.locator(`.react-flow__node[data-id="${target}"]`).click();await expect(inspect).toHaveValue(target);await page.getByLabel('Node name',{exact:true}).fill('Database transform');
  await expect.poll(async()=>{const d=await(await context.request.get('/api/workspace')).json();return d.state.workflows.find((w:{name:string})=>w.name==='Cloud editor regression')?.nodes[1]?.data.label;}).toBe('Database transform');
  await page.reload();await expect(page.locator('.react-flow__node')).toHaveCount(2);await page.getByRole('button',{name:'Run simulation',exact:true}).click();await page.getByRole('button',{name:'Pause execution'}).click();await page.getByRole('button',{name:'Next step'}).click();await page.getByRole('button',{name:'Next step'}).click();
  await expect.poll(async()=>{const d=await(await context.request.get('/api/workspace')).json();return d.state.executions.some((e:{name:string})=>e.name==='Cloud editor regression');}).toBe(true);
});
test("local backup import is confirmed, additive, repeat-safe and preserves original",async({page,context})=>{
  await login(context,b);const old=await(await context.request.get('/api/workspace')).json();
  const incoming={...old.state,workflows:[{id:'legacy',name:'Legacy local',description:'Original',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'n0',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'1',email:'x@example.com'}}}],edges:[]}]};
  const raw=JSON.stringify(incoming);await page.addInitScript(raw=>{localStorage.setItem('flowforge:v1',raw);},raw);await page.goto('/workflows');await page.getByRole('button',{name:'Review local import'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Review local import'}).click();await page.getByRole('button',{name:'Confirm import',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('flowforge:v1'))||'{}')).toEqual(incoming);
  const once=await(await context.request.get('/api/workspace')).json();const repeated=await context.request.post('/api/workspace/import',{headers:{Origin:'http://localhost:43821'},data:{state:incoming}});expect(repeated.status()).toBe(200);expect((await repeated.json()).state.workflows.length).toBe(once.state.workflows.length);
});
test("autosave network failure retains the account draft and explicit retry persists it",async({page,context})=>{
  await login(context);const initial=await(await context.request.get('/api/workspace')).json();
  const id='retry-regression';const workflow={id,name:'Before retry',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'n0',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'10',email:'t@example.com'}}}],edges:[]};
  expect((await context.request.post('/api/workflows',{headers:{Origin:'http://localhost:43821'},data:{workflow,revision:initial.revision}})).status()).toBe(200);
  await page.goto(`/workflows/${id}`);await expect(page.locator('.cloud-status').first()).toContainText('Saved to workspace');
  let failed=false;await page.route('**/api/workspace',async route=>{if(route.request().method()==='PUT'&&!failed){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test fixture network failure'})});}else await route.continue();});
  await page.getByLabel('Workflow name',{exact:true}).fill('Recovered after retry');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry save',exact:true})).toBeVisible();expect(await page.evaluate(id=>localStorage.getItem(`flowforge:draft:${id}`),a)).toContain('Recovered after retry');
  await page.getByRole('button',{name:'Retry save',exact:true}).click();await expect.poll(async()=>{const d=await(await context.request.get(`/api/workflows/${id}`)).json();return d.name;}).toBe('Recovered after retry');
});
test("stalled saves time out, retain the draft and recover on explicit retry",async({page,context})=>{
  await login(context);const initial=await(await context.request.get('/api/workspace')).json();const id='timeout-regression';
  const workflow={id,name:'Before timeout',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'n0',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'10',email:'t@example.com'}}}],edges:[]};
  expect((await context.request.post('/api/workflows',{headers:{Origin:'http://localhost:43821'},data:{workflow,revision:initial.revision}})).status()).toBe(200);
  await page.goto(`/workflows/${id}`);await expect(page.locator('.cloud-status').first()).toContainText('Saved to workspace');
  // Accelerate the browser's timeout only; production keeps its 30-second limit.
  await page.evaluate(()=>{const timeout=AbortSignal.timeout.bind(AbortSignal);AbortSignal.timeout=()=>timeout(100);});
  await page.route('**/api/workspace',route=>{if(route.request().method()!=='PUT')return route.continue();});
  await page.getByLabel('Workflow name',{exact:true}).fill('Recovered after timeout');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry save',exact:true})).toBeVisible();
  expect(await page.evaluate(id=>localStorage.getItem(`flowforge:draft:${id}`),a)).toContain('Recovered after timeout');
  await page.unroute('**/api/workspace');await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect.poll(async()=>{const d=await(await context.request.get(`/api/workflows/${id}`)).json();return d.name;}).toBe('Recovered after timeout');
});

test("real revision conflict preserves the draft and offers export before server reload",async({page,context})=>{
  await login(context);const initial=await(await context.request.get('/api/workspace')).json();const id=`conflict-${crypto.randomUUID()}`;
  const workflow={id,name:'Before conflict',description:'',active:false,updatedAt:new Date().toISOString(),nodes:[{id:'n0',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'10',email:'t@example.com'}}}],edges:[]};
  expect((await context.request.post('/api/workflows',{headers:{Origin:'http://localhost:43821'},data:{workflow,revision:initial.revision}})).status()).toBe(200);
  await page.goto(`/workflows/${id}`);
  // The editor records its first exploration asynchronously. Wait for that write
  // before taking the revision used to simulate a separate tab's edit.
  await expect.poll(async()=>(await(await context.request.get('/api/workspace')).json()).onboarding).toContain('explored');
  await expect(page.locator('.cloud-status').first()).toContainText('Saved to workspace');
  const latest=await(await context.request.get('/api/workspace')).json();expect((await context.request.put(`/api/workflows/${id}`,{headers:{Origin:'http://localhost:43821'},data:{workflow:{...workflow,name:'Other tab edit'},revision:latest.revision}})).status()).toBe(200);
  await page.getByLabel('Workflow name',{exact:true}).fill('My preserved edit');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.cloud-status').first()).toContainText('Save conflict');
  expect(await page.evaluate(id=>localStorage.getItem(`flowforge:draft:${id}`),a)).toContain('My preserved edit');
  // Reload intentionally encounters the unsaved-work guard. Model the user's
  // confirmation before clicking; leaving the native dialog unresolved stalls Chrome.
  const confirmation=page.waitForEvent('dialog').then(async dialog=>{
    expect(dialog.type()).toBe('beforeunload');
    await dialog.accept();
  });
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export and reload server version',exact:true}).click();
  await confirmation;
  const exported=await download;
  expect(exported.suggestedFilename()).toBe('flowforge-unsaved-draft.json');
  expect(await exported.failure()).toBeNull();
  const draft=JSON.parse(await readFile((await exported.path())!,'utf8'));
  expect(draft.workflows.find((w:{id:string})=>w.id===id).name).toBe('My preserved edit');
  await expect(page.getByLabel('Workflow name',{exact:true})).toHaveValue('Other tab edit');
  expect(await page.evaluate(id=>localStorage.getItem(`flowforge:draft:${id}`),a)).toBeNull();
});
test("PKCE start/callback and workspace bootstrap succeed with local OAuth fixture",async({page,context})=>{
  await page.goto('/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page).toHaveURL(/\/dashboard/);await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
  const cookies=await context.cookies();expect(cookies.some(c=>c.name.startsWith('sb-')&&c.name.includes('auth-token')&&c.httpOnly)).toBe(true);
  const workspace=await(await context.request.get('/api/workspace')).json();expect(workspace.workspaceId).toBeTruthy();
});

test("expired Supabase cookie refreshes through proxy (local Auth fixture)",async({page,context})=>{
  await login(context,a,"google",true);const before=(await context.cookies()).find(c=>c.name==='sb-127-auth-token')!.value;
  await page.goto('/dashboard');await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
  const after=(await context.cookies()).find(c=>c.name==='sb-127-auth-token')!;expect(after.value).not.toBe(before);expect(after.httpOnly).toBe(true);
});
test("cloud list reaches more than 100 matching workflows",async({page,context})=>{
  await login(context);const envelope=await(await context.request.get('/api/workspace')).json();
  const base={description:"",active:false,updatedAt:new Date().toISOString(),nodes:[{id:'n0',type:'forge',position:{x:0,y:0},data:{kind:'trigger',label:'Start',config:{amount:'10',email:'t@example.com'}}}],edges:[]};
  envelope.state.workflows.push(...Array.from({length:125},(_,i)=>({...base,id:`load-${i}`,name:`Load list ${i}`})));
  expect((await context.request.put('/api/workspace',{headers:{Origin:'http://localhost:43821'},data:{state:envelope.state,revision:envelope.revision}})).status()).toBe(200);
  await page.goto('/workflows');await page.getByLabel('Search workflows').fill('Load list');await expect(page.locator('.workflow-table tbody tr')).toHaveCount(25);
  for(const count of [50,75,100,125]){await page.getByRole('button',{name:'Load more workflows'}).click();await expect(page.locator('.workflow-table tbody tr')).toHaveCount(count);}
  await page.getByLabel('Search workflows').fill('Load list 124');await expect(page.locator('.workflow-table tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Duplicate Load list 124',exact:true}).click();await expect(page.locator('.workflow-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.cloud-status').first()).toContainText('Saved to workspace');
  await page.getByRole('button',{name:'Delete Load list 124 (copy)',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete workflow',exact:true}).click();await expect(page.locator('.workflow-table tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:/^Active\s/}).click();await expect(page.locator('.workflow-table tbody tr')).toHaveCount(0);
  await page.getByRole('button',{name:/^Drafts\s/}).click();await expect(page.locator('.workflow-table tbody tr')).toHaveCount(1);
});
