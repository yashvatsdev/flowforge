import { Browser, sleep } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const dir='.taste-skill/playback';mkdirSync(dir,{recursive:true});
const results=[];const browser=await Browser.launch();const base='http://127.0.0.1:3000';
try {
 const page=await browser.newPage({width:1440,height:1000});
 await page.goto(base+'/workflows/order-intake');
 results.push(await page.eval(()=>({check:'Node previews show configuration values',passed:document.querySelectorAll('.node-config-preview').length===6&&document.querySelector('.node-config-preview').textContent.includes('149')})));
 await page.eval(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Run simulation')).click());await sleep(1350);
 await page.eval(()=>document.querySelector('[aria-label="Pause execution"]').click());
 const completed=await page.eval(()=>Number(document.querySelector('progress').value));await sleep(1500);
 results.push(await page.eval((expected)=>({check:'Pause preserves count without recording a partial run',passed:Number(document.querySelector('progress').value)===expected&&JSON.parse(localStorage.getItem('flowforge:v1')).executions.length===0}),completed));
 await page.eval(()=>[...document.querySelectorAll('.playback-controls button')].find(button=>button.textContent.includes('Next step')).click());await sleep(150);
 results.push(await page.eval((expected)=>({check:'Single step advances once and highlights payload additions',passed:Number(document.querySelector('progress').value)===expected+1&&[...document.querySelectorAll('.payload-field[data-changed=true]')].some(row=>row.textContent.includes('source')&&row.textContent.includes('Added'))}),completed));
 await page.eval(()=>[...document.querySelectorAll('.payload-switch button')].find(button=>button.textContent==='Input').click());
 results.push(await page.eval(()=>({check:'Input excludes fields added by the current transform',passed:!document.querySelector('.payload-fields').textContent.includes('source')})));
 await page.eval(()=>[...document.querySelectorAll('.payload-switch button')].find(button=>button.textContent==='Output').click());
 await page.screenshot({path:dir+'/1440-paused.jpg',fullPage:true});
 await page.eval(()=>document.querySelector('[aria-label="Resume execution"]').click());await sleep(6200);
 results.push(await page.eval(()=>{const stored=JSON.parse(localStorage.getItem('flowforge:v1'));return {check:'Completed playback records one run and dims skipped branch',passed:stored.executions.length===1&&stored.executions[0].status==='success'&&document.querySelectorAll('.playback-edge-skipped').length===1&&!document.querySelector('.react-flow__edge.animated')};}));
 await page.screenshot({path:dir+'/1440-complete.jpg',fullPage:true});
 await page.eval(()=>{const select=document.querySelector('[aria-label="Workflow inspector"]>label select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'n3');select.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(150);
 await page.eval(()=>{const field=[...document.querySelectorAll('.config-panel label')].find(label=>label.textContent.includes('Simulate a failure')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,'true');field.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(1000);
 results.push(await page.eval(()=>({check:'Editing configuration updates preview and clears stale playback',passed:document.querySelector('[data-id="n3"] .node-config-preview').textContent.includes('503')&&!document.querySelector('.playback-toolbar')&&document.querySelector('.saved-feedback')!==null})));
 await page.eval(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Run simulation')).click());await sleep(150);
 await page.eval(()=>{const select=document.querySelector('[aria-label="Playback speed"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'2');select.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(4300);
 results.push(await page.eval(()=>{const stored=JSON.parse(localStorage.getItem('flowforge:v1'));return {check:'Failure playback marks failed request and skips downstream path',passed:stored.executions.length===2&&stored.executions[0].status==='failed'&&document.querySelectorAll('.playback-edge-failed').length===1&&document.querySelector('[data-id="n4"] .forge-node').classList.contains('skipped')};}));
 await page.goto(base+'/dashboard');
 results.push(await page.eval(()=>({check:'Dashboard differentiates successful and failed executions',passed:document.querySelector('.chart-segment-success[style*="50%"]')!==null&&document.querySelector('.chart-segment-failed[style*="50%"]')!==null})));
 await page.screenshot({path:dir+'/1440-dashboard.jpg',fullPage:true});
 for(const width of [768,390]) {await page.setViewport({width,height:1000});await page.goto(base+'/workflows/order-intake');await page.eval(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Run simulation')).click());await sleep(1300);await page.eval(()=>document.querySelector('[aria-label="Pause execution"]').click());results.push(await page.eval(()=>({check:'Playback stays within viewport',width:innerWidth,passed:document.documentElement.scrollWidth===innerWidth})));await page.screenshot({path:dir+`/${width}-playback.jpg`,fullPage:true});}
 const reduced=await browser.newPage({width:390,height:844,reducedMotion:true});await reduced.goto(base+'/workflows/order-intake');await reduced.eval(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Run simulation')).click());await sleep(1500);
 results.push(await reduced.eval(()=>({check:'Reduced motion keeps controls working without moving connectors',passed:!!document.querySelector('[aria-label="Pause execution"]')&&!document.querySelector('.react-flow__edge.animated')&&document.documentElement.scrollWidth===innerWidth})));
 results.push({consoleErrors:[...page.consoleErrors,...reduced.consoleErrors]});
} finally {await browser.close();}
writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
