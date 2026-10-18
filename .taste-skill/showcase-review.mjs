import { Browser, sleep } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const dir='.taste-skill/showcase';
mkdirSync(dir,{recursive:true});
const browser=await Browser.launch();
const results=[];
try {
 const page=await browser.newPage({width:1440,height:1000});
 await page.goto('http://127.0.0.1:3000');
 await page.eval(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('#use-cases').scrollIntoView({block:'center',behavior:'instant'});});
 await sleep(1000);
 const seen=new Set();
 const events=new Set();
 for(let sample=0;sample<12;sample++) {
  const state=await page.eval(()=>({tab:document.querySelector('[role=tab][aria-selected=true]').textContent,event:document.querySelector('.ff-case-event').textContent}));
  seen.add(state.tab);events.add(state.event);
  await sleep(1900);
 }
 results.push({check:'Auto tour explores all three cases with changing execution steps',passed:seen.size===3&&events.size>=8,cases:[...seen],events:events.size});
 await page.eval(()=>document.querySelector('.ff-case-autoplay').click());
 const paused=await page.eval(()=>document.querySelector('.ff-case-event').textContent);
 await sleep(2100);
 results.push(await page.eval((expected)=>({check:'Pause stops automatic progression',passed:document.querySelector('.ff-case-event').textContent===expected}),paused));
 await page.eval(()=>document.querySelector('#case-tab-1').click());
 await sleep(600);
 results.push(await page.eval(()=>({check:'Manual tab selection pauses and changes content',passed:document.querySelector('#case-panel h3').textContent.includes('warmer')&&document.querySelector('.ff-case-autoplay').textContent.includes('Auto-explore')})));
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
 // Select a tab using focus plus real keyboard input.
 await page.eval(()=>document.querySelector('#case-tab-1').focus());
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
 await sleep(600);
 results.push(await page.eval(()=>({check:'Arrow keys select the next use case',passed:document.querySelector('#case-tab-2').getAttribute('aria-selected')==='true'&&document.activeElement.id==='case-tab-2'})));
 await page.screenshot({path:dir+'/desktop-cases.jpg'});
 for(const width of [1440,768,390]) {
  await page.setViewport({width,height:1000});
  for(const route of ['/dashboard','/workflows/order-intake','/templates']) {
   await page.goto('http://127.0.0.1:3000'+route);
   results.push(await page.eval(()=>({route:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth})));
   if(width!==768&&route!=='/templates') await page.screenshot({path:dir+`/${width}-${route.includes('order')?'editor':'dashboard'}.jpg`,fullPage:true});
   if(route.includes('order')) results.push(await page.eval(()=>({check:'Editor colors differentiate all five node types and their connections',passed:new Set([...document.querySelectorAll('.forge-node')].map(node=>getComputedStyle(node).borderLeftColor)).size===5&&new Set([...document.querySelectorAll('.react-flow__edge-path')].map(edge=>getComputedStyle(edge).stroke)).size>=4})));
  }
 }
 const reduced=await browser.newPage({width:390,height:844,reducedMotion:true});
 await reduced.goto('http://127.0.0.1:3000');
 await reduced.eval(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('#use-cases').scrollIntoView({block:'center',behavior:'instant'});});
 const staticState=await reduced.eval(()=>document.querySelector('.ff-case-event').textContent);
 await sleep(2200);
 results.push(await reduced.eval((expected)=>({check:'Reduced motion uses stable manual exploration',passed:document.querySelector('.ff-case-event').textContent===expected&&!document.querySelector('.ff-case-autoplay')&&document.documentElement.scrollWidth===innerWidth}),staticState));
 await reduced.screenshot({path:dir+'/390-cases.jpg'});
 results.push({consoleErrors:[...page.consoleErrors,...reduced.consoleErrors]});
} finally {await browser.close();}
writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
