const { chromium } = require('playwright');
const path = require('node:path');
const ROOT = __dirname;
const fs = require('node:fs');

const URL = process.env.DEMO_URL || 'http://localhost:8766/';
const OUT = path.join(ROOT, 'raw');
const MARKS = path.join(OUT, 'regenerated-markers.json');
const TAKE = path.join(OUT, 'regenerated.webm');
const markers = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CURSOR_JS = `
(() => {
  const style = document.createElement('style');
  style.textContent = \`
    #__cur { position:fixed; width:26px; height:26px; border:2px solid #152622;
      border-radius:50%; background:rgba(221,247,104,.45); z-index:2147483647;
      pointer-events:none; transform:translate(-50%,-50%); left:-100px; top:-100px;
      transition:box-shadow .12s; }
    #__cur.down { box-shadow:0 0 0 10px rgba(183,71,50,.35); }
    #__ring { position:fixed; width:6px; height:6px; background:#152622; border-radius:50%;
      z-index:2147483647; pointer-events:none; transform:translate(-50%,-50%); left:-100px; top:-100px; }\`;
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
    const c = document.createElement('div'); c.id='__cur';
    const r = document.createElement('div'); r.id='__ring';
    document.body.appendChild(c); document.body.appendChild(r);
    addEventListener('mousemove', e => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px';
      r.style.left=e.clientX+'px'; r.style.top=e.clientY+'px'; });
    addEventListener('mousedown', () => c.classList.add('down'));
    addEventListener('mouseup', () => c.classList.remove('down'));
  });
})();`;

async function moveTo(page, sel, opts={}) {
  const el = page.locator(sel).first();
  const box = await el.boundingBox();
  if (!box) return;
  const x = box.x + box.width/2 + (opts.dx||0), y = box.y + box.height/2 + (opts.dy||0);
  await page.mouse.move(x, y, { steps: 18 });
  await sleep(350);
}
async function clickEl(page, sel, opts={}) {
  await moveTo(page, sel, opts);
  await page.locator(sel).first().click();
  await sleep(opts.after ?? 500);
}
async function submit(page, wait=1600) {
  await clickEl(page, '#survey-form button[type="submit"]');
  await sleep(wait);
}
async function smoothScroll(page, y) {
  await page.evaluate(async (target) => {
    const start = scrollY, dist = target - start;
    for (let i = 1; i <= 30; i++) {
      scrollTo(0, start + dist * i / 30);
      await new Promise(r => setTimeout(r, 33));
    }
  }, y);
}

(async () => {
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
await ctx.addInitScript(CURSOR_JS);
const page = await ctx.newPage();
const t0 = Date.now();
const mark = async name => { markers[name] = (Date.now() - t0) / 1000; fs.writeFileSync(MARKS, JSON.stringify(markers, null, 2)); };

await page.goto(URL);
await page.waitForSelector('[data-action="pick"]');
await sleep(1200);
await mark('beat2');                       // entry screen dwell
await sleep(2600);

// --- cyber flow (beat 2) ---
await moveTo(page, '[data-action="pick"][data-case="cyber"]');
await sleep(700);
await clickEl(page, '[data-action="pick"][data-case="cyber"]');
await sleep(2100);                          // Q1 extraMonths (2)
await submit(page);
await sleep(900);                           // Q2 pay (4500)
await submit(page);
await sleep(900);                           // choice: other paycheck?
await clickEl(page, '[data-action="followup"][data-opt="yes"]');
await sleep(1100);                          // Q3 alt pay (3000)
await submit(page);
await mark('beat3');                        // cyber result
await sleep(2500);
await smoothScroll(page, 700); await sleep(2600);
await smoothScroll(page, 1400); await sleep(3000);
await smoothScroll(page, 2100); await sleep(3500);
await smoothScroll(page, 300); await sleep(1500);

// --- yen flow (beat 4) ---
await mark('beat4');
await clickEl(page, '[data-action="back"]', { after: 1400 });
await clickEl(page, '[data-action="pick"][data-case="yen"]', { after: 1500 });
await clickEl(page, '[data-action="followup"][data-opt="yen-invoice"]', { after: 1700 });
await submit(page);                          // yenDue 600000
await sleep(700);
await clickEl(page, '[data-action="followup"][data-opt="no"]', { after: 1400 });
await submit(page);                          // budgetRate 150
await sleep(700);
await submit(page);                          // scenarioRate 125
await mark('beat5');                         // yen result
await sleep(2400);
await smoothScroll(page, 800); await sleep(2800);
await smoothScroll(page, 1600); await sleep(2000);
// open adjust details
await page.locator('details.hedge-settings summary').scrollIntoViewIfNeeded();
await clickEl(page, 'details.hedge-settings summary', { after: 1200 });
await clickEl(page, '#f-position', { after: 500 });
await page.locator('#f-position').fill('');
await page.locator('#f-position').pressSequentially('2000', { delay: 160 });
await sleep(900);
await clickEl(page, '#hedge-form button[type="submit"]', { after: 1600 });
await smoothScroll(page, 800); await sleep(3500);
await mark('end');
await sleep(600);

await ctx.close();
await page.video().saveAs(TAKE);
await browser.close();
fs.writeFileSync(MARKS, JSON.stringify(markers, null, 2));
console.log(JSON.stringify(markers));

})().catch(e => { console.error(e); process.exit(1); });
