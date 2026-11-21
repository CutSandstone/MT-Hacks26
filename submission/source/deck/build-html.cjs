const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const here = __dirname;
const target = path.resolve(here, '../..', 'What Would Hedge This - Pitch Deck.html');
const three = path.resolve(path.dirname(require.resolve('three')), '..');

async function main() {
  const css = fs.readFileSync(path.join(here, 'player.css'), 'utf8');
  const original = fs.readFileSync(path.join(here, 'visual-slides.html'), 'utf8');
  const license = fs.readFileSync(path.join(three, 'LICENSE'), 'utf8');
  const js = await esbuild.build({
    entryPoints:[path.join(here, 'player.js')], format:'iife', bundle:true, minify:true,
    legalComments:'none', write:false, alias:{three:path.join(three, 'build/three.module.js')}
  });
  const chrome = `<main id="deck-view" aria-label="Pitch deck"><div id="deck-stage"></div></main>
<nav class="deck-controls" aria-label="Slide controls">
  <button id="deck-prev" type="button">Previous</button>
  <output id="deck-counter" aria-live="polite">1 / 7</output>
  <button id="deck-next" type="button">Next</button>
  <button id="deck-full" type="button" aria-pressed="false">Fullscreen</button>
</nav>`;
  const bundle = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = original
    .replace('</head>', () => `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>`)
    .replace('</body>', () => `${chrome}\n<script>\n/* Three.js — MIT License\n${license}*/\n${bundle}\n</script>\n</body>`);
  fs.writeFileSync(target, html);
  console.log(target);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
