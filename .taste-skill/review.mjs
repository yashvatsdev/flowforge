import { Browser, sleep } from 'file:///C:/Users/yashv/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const directory = '.taste-skill/product-review';
mkdirSync(directory, { recursive: true });
const browser = await Browser.launch();
const results = [];
const baseUrl = process.argv[2] || 'http://127.0.0.1:43820';
try {
  const page = await browser.newPage();
  for (const width of [1440, 768, 390]) {
    await page.setViewport({ width, height: width === 1440 ? 1000 : 1000 });
    for (const route of ['/dashboard', '/workflows/order-intake']) {
      await page.goto(baseUrl + route);
      await page.screenshot({ path: `${directory}/${width}-${route.includes('order') ? 'editor' : 'dashboard'}.jpg`, fullPage: true });
      results.push(await page.eval(() => ({ route: location.pathname, width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, heading: document.querySelector('h1,input[aria-label="Workflow name"]')?.textContent, errors: [] })));
    }
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(baseUrl);
  results.push(await page.eval(() => {
    document.querySelector('[aria-label="Pause simulation"]')?.click();
    document.querySelector('.ff-node-5')?.click();
    return { check: 'landing has six graph nodes', passed: document.querySelectorAll('.ff-node').length === 6 };
  }));
  await sleep(100);
  results.push(await page.eval(() => ({ check: 'high-value order skips standard queue', passed: document.querySelector('.ff-inspection code').textContent.includes('Skipped') })));
  await page.eval(() => { const select = document.querySelector('.ff-demo-controls select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '49'); select.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(150);
  results.push(await page.eval(() => ({ check: 'changing amount routes standard order', passed: document.querySelector('.ff-node-3').classList.contains('is-skipped') && !document.querySelector('.ff-node-5').classList.contains('is-skipped') && !document.querySelector('.ff-inspection code').textContent.includes('Skipped') })));
  await page.eval(() => document.querySelector('#case-tab-1').click());
  await sleep(150);
  results.push(await page.eval(() => ({ check: 'use-case selection updates content and destination', passed: document.querySelector('#case-panel h3').textContent.includes('warmer') && document.querySelector('#case-panel a').getAttribute('href') === '/workflows/lead-enrichment' })));
  await page.eval(() => document.querySelector('.ff-faq summary').click());
  results.push(await page.eval(() => ({ check: 'FAQ expands', passed: document.querySelector('.ff-faq details').open })));
  await page.goto(baseUrl + '/workflows/order-intake');
  await page.eval(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Run simulation')).click());
  await sleep(5000);
  results.push(await page.eval(() => { const state = JSON.parse(localStorage.getItem('flowforge:v1')); return { check: 'editor run persists execution', passed: state.executions.length > 0 && state.executions[0].status === 'success', executions: state.executions.length }; }));
  await page.goto(baseUrl + '/dashboard');
  results.push(await page.eval(() => ({ check: 'dashboard renders recorded run', passed: document.querySelector('.recent-run') !== null, metric: document.querySelectorAll('.metric>strong')[1].textContent })));
  await page.goto(baseUrl + '/executions');
  results.push(await page.eval(() => ({ check: 'history renders recorded run', passed: document.body.innerText.includes('Order intake') })));
  const reduced = await browser.newPage({ width: 390, height: 844, reducedMotion: true });
  await reduced.goto(baseUrl);
  results.push(await reduced.eval(() => ({ check: 'reduced motion offers manual preview with visible content', passed: document.body.innerText.includes('Manual preview') && !!document.querySelector('[aria-label="Advance simulation"]') && getComputedStyle(document.querySelector('.ff-intro h1')).opacity === '1', overflow: document.documentElement.scrollWidth - innerWidth })));
  await reduced.screenshot({ path: `${directory}/390-reduced.jpg` });
  await reduced.goto(baseUrl + '/dashboard');
  await reduced.eval(() => document.querySelector('[aria-label="Open menu"]').click());
  await sleep(100);
  results.push(await reduced.eval(() => ({ check: 'mobile menu opens with keyboard focus', passed: document.querySelector('#workspace-navigation').contains(document.activeElement) && document.querySelector('[aria-label="Open menu"]').getAttribute('aria-expanded') === 'true' })));
  await reduced.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await reduced.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await sleep(100);
  results.push(await reduced.eval(() => ({ check: 'Escape closes menu and restores focus', passed: document.activeElement === document.querySelector('[aria-label="Open menu"]') && document.querySelector('[aria-label="Open menu"]').getAttribute('aria-expanded') === 'false' })));
  results.push({ consoleErrors: page.consoleErrors.concat(reduced.consoleErrors) });
} finally { await browser.close(); }
writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
