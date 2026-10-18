import { Browser } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const browser = await Browser.launch();
try {
 for (const reducedMotion of [false,true]) {
  const page = await browser.newPage({width:390,height:844,reducedMotion});
  for (const route of ['/', '/dashboard','/workflows/order-intake']) {
   await page.goto('http://127.0.0.1:3000'+route);
   console.log(JSON.stringify({route,reducedMotion,errors:page.consoleErrors,layout:await page.eval(() => ({overflow:document.documentElement.scrollWidth-innerWidth,offenders:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>innerWidth+2 && getComputedStyle(element).position!=='fixed').map(element=>({tag:element.tagName,class:element.className,right:Math.round(element.getBoundingClientRect().right)})).slice(0,20)}))}));
   page.consoleErrors=[];
  }
 }
} finally { await browser.close(); }
