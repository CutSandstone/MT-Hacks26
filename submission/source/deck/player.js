import {
  WebGLRenderer, Scene, OrthographicCamera, Group, Mesh, MeshBasicMaterial,
  LineBasicMaterial, LineSegments, BufferGeometry, BoxGeometry, CylinderGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3, PlaneGeometry, EdgesGeometry
} from 'three';

const C = { ink: 0x152622, forest: 0x10362c, lime: 0xddf768, rust: 0xb74732,
            coral: 0xd98a6f, sage: 0x8fb598, ivory: 0xf5f1e8 };
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = t => Math.min(1, Math.max(0, t));

const slides = [...document.querySelectorAll('body > section')];
const view = document.querySelector('#deck-view'), stage = document.querySelector('#deck-stage');
const prev = document.querySelector('#deck-prev'), next = document.querySelector('#deck-next');
const counter = document.querySelector('#deck-counter'), full = document.querySelector('#deck-full');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const fit = () => stage.style.transform = `scale(${Math.min(view.clientWidth / 1280, view.clientHeight / 720)})`;
let i = 0, animation = 0, gl, current;

slides.forEach((slide, j) => {
  slide.setAttribute('aria-label', `Slide ${j + 1} of ${slides.length}`);
  stage.append(slide);
});
document.documentElement.classList.add('deck-ready');
new ResizeObserver(fit).observe(view);
fit();

/* ---------- shared drawing helpers ---------- */

const line = (pts, color, opacity = 1) => new LineSegments(
  new BufferGeometry().setFromPoints(pts),
  new LineBasicMaterial({ color, transparent: true, opacity }));

function gridLines(w, h, step, color, opacity, y = 0) {
  const pts = [];
  for (let x = -w / 2; x <= w / 2 + .001; x += step)
    pts.push(new Vector3(x, y, -h / 2), new Vector3(x, y, h / 2));
  for (let z = -h / 2; z <= h / 2 + .001; z += step)
    pts.push(new Vector3(-w / 2, y, z), new Vector3(w / 2, y, z));
  return line(pts, color, opacity);
}

function axes(x0, y0, w, h, color, opacity) {
  return line([new Vector3(x0, y0, 0), new Vector3(x0 + w, y0, 0),
               new Vector3(x0, y0, 0), new Vector3(x0, y0 + h, 0)], color, opacity);
}

// bar anchored on the left: scale.x stretches it rightward
const anchorBar = (h, d, color, opacity = 1) => {
  const g = new BoxGeometry(1, h, d); g.translate(.5, 0, 0);
  return new Mesh(g, new MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
};

function tube(points, radius, color) {
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)));
  const geo = new TubeGeometry(curve, 70, radius, 10, false);
  geo.setDrawRange(0, 0);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ color }));
  const total = geo.index.count;
  mesh.userData.draw = p => geo.setDrawRange(0, Math.floor(total * clamp01(p) / 3) * 3);
  return mesh;
}

const edgeBox = (w, h, d, color, opacity = 1) => {
  const g = new BoxGeometry(w, h, d);
  const e = new LineSegments(new EdgesGeometry(g),
    new LineBasicMaterial({ color, transparent: true, opacity }));
  g.dispose();
  return e;
};

function arrive(group, items, spread = .22) {
  // items: [{obj, y}] — each slides down into place + fades, staggered
  group.userData.reveal = p => items.forEach(({ obj, y }, k) => {
    const t = ease(clamp01((p - k * spread) / (1 - k * spread * .5)));
    obj.position.y = y + (1 - t) * 2.2;
    obj.traverse(o => { if (o.material) o.material.opacity = (o.userData.o ??= o.material.opacity) * t; });
  });
}

/* ---------- scenes ---------- */

function sceneHook() {
  const g = new Group();
  const chart = new Group();
  chart.rotation.x = -.42; chart.rotation.z = -.04;
  chart.add(gridLines(9.5, 5.5, 1.1, C.sage, .22, -.05));
  const coral = tube([[-4.3, .4, 0], [-1.6, .15, 0], [1.2, -1.5, 0], [4.3, -2.9, 0]], .085, C.coral);
  const lime = tube([[-4.3, .4, 0], [-1.6, .85, 0], [1.2, 1.9, 0], [4.3, 2.9, 0]], .085, C.lime);
  const pivot = new Mesh(new BoxGeometry(.24, .24, .24), new MeshBasicMaterial({ color: C.ivory }));
  pivot.position.set(-4.3, .4, 0);
  chart.add(coral, lime, pivot);
  g.add(chart);
  g.userData.reveal = p => {
    coral.userData.draw(ease(clamp01(p / .9)));
    // lime finishes last ~10% slowly — endpoint hesitates before resolving
    lime.userData.draw(p < .9 ? ease(p / .9) * .96 : .96 + .04 * ease((p - .9) / .1));
    pivot.scale.setScalar(.4 + .6 * ease(clamp01(p / .15)));
  };
  return { group: g, duration: 1700 };
}

function sceneTitle() {
  const g = new Group();
  const items = [];
  const cube = new Group();
  cube.add(edgeBox(1.9, 1.9, 1.9, C.forest));
  const face = new Mesh(new PlaneGeometry(1.9, 1.9),
    new MeshBasicMaterial({ color: C.lime, transparent: true, opacity: .3 }));
  face.position.z = .951; cube.add(face);
  items.push({ obj: cube, y: .4 });
  const coins = new Group();
  for (let k = 0; k < 3; k++) {
    const coin = new Mesh(new CylinderGeometry(1.05, 1.05, .22, 40),
      new MeshBasicMaterial({ color: k === 2 ? C.lime : C.forest, transparent: true }));
    coin.position.y = k * .26 - .3; coins.add(coin);
    const rim = new LineSegments(new EdgesGeometry(new CylinderGeometry(1.05, 1.05, .22, 24)),
      new LineBasicMaterial({ color: C.ink, transparent: true, opacity: .5 }));
    rim.position.copy(coin.position); coins.add(rim);
  }
  items.push({ obj: coins, y: .4 });
  const pair = new Group();
  const solid = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshBasicMaterial({ color: C.forest, transparent: true }));
  solid.position.x = -.86;
  const ghost = edgeBox(1.5, 1.5, 1.5, C.rust);
  ghost.position.x = .86;
  pair.add(solid, ghost);
  items.push({ obj: pair, y: .4 });
  cube.position.x = -3.9; coins.position.x = 0; pair.position.x = 3.9;
  items.forEach(({ obj }) => g.add(obj));
  g.rotation.x = -.12;
  arrive(g, items);
  return { group: g, duration: 1500 };
}

function sceneCareer() {
  const g = new Group();
  const chart = new Group();
  chart.rotation.x = -.3;
  chart.add(gridLines(8.5, 4, 1, C.sage, .18, -2.2));
  chart.add(axes(-3.6, -2.2, 7.4, 4.4, C.sage, .5));
  const a = edgeBox(1.5, 2.6, 1.5, C.sage, .95);       // hiring bar
  const b = edgeBox(1.5, 2.6, 1.5, C.coral, .95);      // stock bar
  a.position.x = -1.6; b.position.x = 1.6;
  const fillA = new Mesh(new BoxGeometry(1.5, 2.6, 1.5),
    new MeshBasicMaterial({ color: C.forest, transparent: true, opacity: .35 }));
  const fillB = new Mesh(new BoxGeometry(1.5, 2.6, 1.5),
    new MeshBasicMaterial({ color: C.rust, transparent: true, opacity: .3 }));
  a.add(fillA); b.add(fillB);
  chart.add(a, b);
  g.add(chart);
  // under a spending freeze both fall together — synchronized drop, then hold
  g.userData.reveal = p => {
    const y = 2.55 - 3.3 * ease(p);
    a.position.y = y; b.position.y = y;
  };
  return { group: g, duration: 1600 };
}

function sceneBars() {
  const g = new Group();
  const chart = new Group();
  chart.rotation.x = -.14;
  const base = line([new Vector3(-4.4, -2.4, 0), new Vector3(-4.4, 2.4, 0)], C.ink, .8);
  const budget = anchorBar(1, .7, C.forest); budget.position.set(-4.4, 1.15, 0);
  const stressBase = anchorBar(1, .7, C.forest); stressBase.position.set(-4.4, -1.15, 0);
  const stressExt = anchorBar(1, .7, C.rust); stressExt.position.set(1.6, -1.15, 0);
  // anchors at -4.4; budget target length 6, stress base 6 + rust extension 1.2
  budget.scale.x = stressBase.scale.x = stressExt.scale.x = 0;
  chart.add(base, budget, stressBase, stressExt);
  g.add(chart);
  g.userData.reveal = p => {
    budget.scale.x = 6 * ease(clamp01(p / .5));
    stressBase.scale.x = 6 * ease(clamp01((p - .12) / .5));
    stressExt.scale.x = 1.2 * ease(clamp01((p - .58) / .42));
  };
  return { group: g, duration: 1300 };
}

function sceneMatch() {
  const g = new Group();
  const chart = new Group();
  chart.rotation.x = -.18;
  const W = 8.8, X0 = -W / 2, H = 1.5, D = 1;
  const frame = edgeBox(W, H, D, C.ink, .7); // the full $800 shortfall
  chart.add(frame);
  const offset = anchorBar(H - .12, D - .12, C.lime); offset.position.set(X0 + .06, 0, 0);
  const remaining = anchorBar(H - .12, D - .12, C.rust);
  chart.add(offset, remaining);
  const cap = line([new Vector3(X0, -1.4, 0), new Vector3(X0 + W, -1.4, 0)], C.ink, .4);
  chart.add(cap);
  g.add(chart);
  let shown = 0;
  const target = Number(document.querySelector('[data-scene="match"]').dataset.fraction);
  const apply = f => {           // f = offset / 800
    offset.scale.x = Math.max(0, W * f - .06);
    remaining.scale.x = Math.max(0, W * (1 - f) - .06);
    remaining.position.x = X0 + .06 + W * f;
  };
  const api = {
    setFraction(f, animate = true) {
      cancelAnimationFrame(api.raf);
      cancelAnimationFrame(animation);   // stop the entry reveal so it can't race the click
      g.userData.reveal = () => {};
      if (!animate || motion.matches) { shown = f; apply(f); renderOnce(); return; }
      const from = shown, t0 = performance.now();
      const tick = now => {
        const t = clamp01((now - t0) / 450);
        shown = from + (f - from) * ease(t);
        apply(shown); renderOnce();
        if (t < 1) api.raf = requestAnimationFrame(tick);
      };
      api.raf = requestAnimationFrame(tick);
    }
  };
  g.userData.reveal = p => {
    const f = ease(clamp01(p / .8)) * target;   // persisted amount -> offset/800
    shown = f; apply(f);
  };
  return { group: g, duration: 1200, api };
}

function sceneShield() {
  const g = new Group();
  const items = [];
  [[-3.4, .34, C.forest], [0, .24, C.forest], [3.4, .14, C.lime]].forEach(([x, op, edge]) => {
    const slab = new Group();
    const pane = new Mesh(new PlaneGeometry(1.9, 4.4),
      new MeshBasicMaterial({ color: C.forest, transparent: true, opacity: op, side: 2 }));
    const rim = edgeBox(1.9, 4.4, .04, edge === C.lime ? C.forest : C.ink, .9);
    const accent = edgeBox(1.9, 4.4, .04, edge, .95);
    accent.position.z = .05; accent.scale.setScalar(1.02);
    slab.add(pane, rim, accent);
    slab.position.x = x;
    items.push({ obj: slab, y: .2 });
    g.add(slab);
  });
  g.rotation.y = .3; g.rotation.x = -.06;
  arrive(g, items, .26);
  return { group: g, duration: 1400 };
}

function scenePayoff() {
  const g = new Group();
  const chart = new Group();
  chart.rotation.x = -.16; chart.rotation.y = .12;
  const band1 = edgeBox(.9, 3.4, .9, C.sage, .8); band1.position.x = -1.4;
  const band2 = edgeBox(.9, 3.4, .9, C.sage, .8); band2.position.x = 1.2;
  const slot = edgeBox(1.7, 1.5, 1.1, C.lime, .95); slot.position.x = 3.7;
  const strip = new Mesh(new BoxGeometry(1.5, 1.15, .95),
    new MeshBasicMaterial({ color: C.coral }));
  chart.add(band1, band2, slot, strip);
  g.add(chart);
  g.userData.reveal = p => {
    const t = ease(p);
    strip.position.set(-4.6 + 8.3 * t, 0, .6 * (1 - t));
    strip.rotation.z = .3 * (1 - t);
    strip.rotation.y = .5 * (1 - t);
    const bIn = ease(clamp01((p - .3) / .3));
    band1.scale.setScalar(.6 + .4 * bIn); band2.scale.setScalar(.6 + .4 * bIn);
    band1.visible = band2.visible = p > .12;
    slot.scale.setScalar(.5 + .5 * ease(clamp01((p - .7) / .3)));
    slot.visible = p > .5;
  };
  return { group: g, duration: 1800 };
}

const SCENES = {
  hook: sceneHook, title: sceneTitle, career: sceneCareer, bars: sceneBars,
  match: sceneMatch, shield: sceneShield, payoff: scenePayoff
};

/* ---------- renderer ---------- */

function initGL() {
  if (gl !== undefined) return gl;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return gl = null;
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true }); }
  catch { return gl = null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  gl = { canvas, renderer };
  slides.forEach(s => s.classList.add('has-webgl'));
  return gl;
}

function renderOnce() {
  if (!current) return;
  gl.renderer.render(current.scene, current.camera);
  gl.canvas.dataset.frames = String(+gl.canvas.dataset.frames + 1 || 1);
}

function updateVisual() {
  cancelAnimationFrame(animation);
  cancelAnimationFrame(current?.api?.raf ?? 0);
  current?.scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  current = null;
  const slide = slides[i], box = slide.querySelector('.visual');
  if (!box || !initGL()) return;
  const { canvas, renderer } = gl;
  box.append(canvas);
  const w = box.clientWidth || 610, h = box.clientHeight || 490;
  renderer.setSize(w, h, false);
  const factory = SCENES[slide.dataset.scene];
  if (!factory) return;
  const { group, duration, api } = factory();
  const scene = new Scene();
  const halfH = 4.4, halfW = halfH * w / h;
  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, .1, 50);
  camera.position.z = 10;
  scene.add(group);
  current = { scene, camera, api };
  if (motion.matches || document.hidden) { group.userData.reveal(1); renderOnce(); return; }
  const t0 = performance.now();
  const frame = now => {
    const t = clamp01((now - t0) / duration);
    group.userData.reveal(t);
    renderOnce();
    if (t < 1) animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
}

/* ---------- interactive hedge amount (scene: match) ---------- */

{
  const cases = { 0: { remaining: 800, offset: 0 }, 1000: { remaining: 600, offset: 200 },
                  2000: { remaining: 400, offset: 400 } };
  let selected = 1000;
  const slide = document.querySelector('[data-scene="match"]');
  if (slide) {
    const loss = slide.querySelector('#loss-out'), gain = slide.querySelector('#gain-out');
    const choices = [...slide.querySelectorAll('.choices button')];
    const offsetRect = slide.querySelector('#offset-fallback');
    const remainingRect = slide.querySelector('#remaining-fallback');
    function choose(amount) {
      selected = amount;
      const { remaining, offset } = cases[amount];
      const f = offset / 800;
      slide.dataset.fraction = String(f);
      loss.textContent = `−$${remaining}`;
      gain.textContent = offset ? `+$${offset} offset` : '$0 offset';
      choices.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.amount) === amount)));
      const covered = 490 * f;
      offsetRect?.setAttribute('width', covered);
      remainingRect?.setAttribute('x', 60 + covered);
      remainingRect?.setAttribute('width', 490 - covered);
      current?.api?.setFraction(f);
    }
    choices.forEach(b => b.addEventListener('click', () => choose(Number(b.dataset.amount))));
  }
}

/* ---------- navigation ---------- */

function go(n) {
  const focusWasOnControl = document.activeElement === prev || document.activeElement === next;
  i = Math.max(0, Math.min(slides.length - 1, n));
  slides.forEach((slide, j) => { slide.hidden = j !== i; });
  counter.textContent = `${i + 1} / ${slides.length}`;
  prev.disabled = i === 0; next.disabled = i === slides.length - 1;
  if (focusWasOnControl && document.activeElement.disabled) (i === 0 ? next : prev).focus();
  updateVisual();
}
prev.addEventListener('click', () => go(i - 1));
next.addEventListener('click', () => go(i + 1));
full.disabled = !document.fullscreenEnabled || !document.documentElement.requestFullscreen;
full.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
});
document.addEventListener('fullscreenchange', () => {
  full.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  full.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  fit();
});
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
  if (e.key === ' ' && e.target.closest?.('button, a, input, textarea, select, [contenteditable]')) return;
  const targets = { ArrowRight: i + 1, ' ': i + 1, ArrowLeft: i - 1, Home: 0, End: slides.length - 1 };
  if (!Object.hasOwn(targets, e.key)) return;
  e.preventDefault();
  go(targets[e.key]);
});
motion.addEventListener('change', updateVisual);
document.addEventListener('visibilitychange', updateVisual);
go(0);
