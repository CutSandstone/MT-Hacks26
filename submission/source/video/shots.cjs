const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ROOT = __dirname;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  for (const n of ['slide1a', 'slide1b', 'slide6', 'slide7']) {
    await p.goto(pathToFileURL(path.join(ROOT, 'slides', n + '.html')).href);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(ROOT, 'slides', n + '.png') });
    console.log(n, 'ok');
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
