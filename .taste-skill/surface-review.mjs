import { Browser, sleep } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const dir='.taste-skill/surfaces';mkdirSync(dir,{recursive:true});
const browser=await Browser.launch();const results=[];
try {
 const page=await browser.newPage();
 for(const width of [1440,768,390]) {
  await page.setViewport({width,height:1000});
  for(const route of ['/','/dashboard','/workflows/order-intake']) {
   await page.goto('http://127.0.0.1:3000'+route);
   if(route.includes('order')) {
    await page.eval(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Run simulation')).click());await sleep(1450);
    await page.eval(()=>document.querySelector('[aria-label="Pause execution"]').click());
   }
   results.push(await page.eval(()=>({route:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,activePortLight:document.querySelector('.forge-node.running .react-flow__handle')?getComputedStyle(document.querySelector('.forge-node.running .react-flow__handle')).boxShadow:null,heading:getComputedStyle(document.querySelector('h1')||document.querySelector('.editor-name input')).color})));
   await page.screenshot({path:dir+`/${width}-${route==='/'?'landing':route.includes('order')?'editor':'dashboard'}.jpg`,fullPage:route.includes('order')});
  }
 }
 results.push({consoleErrors:page.consoleErrors});
}finally{await browser.close();}
writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
