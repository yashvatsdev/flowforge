import { Browser } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
mkdirSync('.taste-skill/darker',{recursive:true});
const browser=await Browser.launch();const results=[];
try {
 const page=await browser.newPage();
 for(const width of [1440,390]) {
  await page.setViewport({width,height:900});
  for(const route of ['/','/dashboard']) {
   await page.goto('http://127.0.0.1:3000'+route);
   const result=await page.eval(()=>({route:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,background:getComputedStyle(document.body).backgroundColor,base:getComputedStyle(document.documentElement).getPropertyValue('--base').trim(),panel:getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),colorScheme:getComputedStyle(document.documentElement).colorScheme}));
   results.push(result);
   await page.screenshot({path:`.taste-skill/darker/${width}-${route==='/'?'landing':'dashboard'}.jpg`});
  }
 }
 results.push({consoleErrors:page.consoleErrors});
}finally{await browser.close();}
writeFileSync('.taste-skill/darker/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
