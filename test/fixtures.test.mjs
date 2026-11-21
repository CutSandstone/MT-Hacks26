import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, CUSTOM_CASES, ASSUMPTIONS } from '../src/fixtures.js';

const near = (a, b) => Math.abs(a - b) <= 0.005;

test('CASES has three entries with unique ids', () => {
  assert.equal(CASES.length, 3);
  assert.equal(new Set(CASES.map(c => c.id)).size, 3);
});

test('every case has the required structure', () => {
  for (const c of CASES) {
    assert.ok(c.samplePrompt && typeof c.samplePrompt === 'string', `${c.id} samplePrompt`);
    assert.ok(c.followUp && typeof c.followUp.question === 'string', `${c.id} followUp`);
    assert.ok(c.company && c.company.name && c.company.ticker, `${c.id} company`);
    assert.ok(Array.isArray(c.company.sources) && c.company.sources.length >= 1, `${c.id} sources`);
    for (const s of c.company.sources) {
      assert.ok(s.url.startsWith('https://'), `${c.id} source url ${s.url}`);
    }
    assert.ok(Array.isArray(c.scenarios) && c.scenarios.length >= 2, `${c.id} scenarios`);
    assert.ok(c.scenarios.some(s => s.isFailure || s.isCounter), `${c.id} has failure/counter scenario`);
    for (const sc of c.scenarios) {
      assert.ok(sc.label && sc.label.length > 0, `${c.id}/${sc.id} label`);
      assert.ok(sc.reason && sc.reason.length > 0, `${c.id}/${sc.id} reason`);
      for (const k of ['impact', 'gain', 'combined']) {
        assert.equal(typeof sc.expected[k], 'number', `${c.id}/${sc.id} expected.${k}`);
      }
    }
  }
});

test('ASSUMPTIONS are populated', () => {
  assert.ok(Array.isArray(ASSUMPTIONS) && ASSUMPTIONS.length >= 4);
});

test('scenario expected values match engine math at default inputs', async () => {
  const { careerImpact, commutingImpact, tuitionImpactYen, positionGain, yenBenchmarkGain } =
    await import('../src/engine.js');

  for (const c of CASES) {
    const defaults = Object.fromEntries(c.inputs.map(i => [i.name, i.default]));
    for (const sc of c.scenarios) {
      const inp = { ...defaults, ...(sc.impactOverride || {}) };
      let impact;
      if (c.impactType === 'career') impact = careerImpact(inp.extraMonths, inp.cyberMonthlyPay - inp.alternativeMonthlyPay);
      else if (c.impactType === 'commute') impact = commutingImpact(inp.annualMiles, inp.mpg, inp.budgetPrice, inp.scenarioPrice);
      else if (c.impactType === 'tuition-yen') impact = tuitionImpactYen(inp.yenDue, inp.budgetRate, inp.scenarioRate);
      else assert.fail(`unknown impactType ${c.impactType}`);

      const gain = sc.kind === 'yen-cash'
        ? yenBenchmarkGain(c.defaultPosition, defaults.budgetRate, defaults.scenarioRate)
        : positionGain(c.defaultPosition, sc.returnPct / 100);

      assert.ok(near(impact, sc.expected.impact), `${c.id}/${sc.id} impact ${impact} != ${sc.expected.impact}`);
      assert.ok(near(gain, sc.expected.gain), `${c.id}/${sc.id} gain ${gain} != ${sc.expected.gain}`);
      assert.ok(near(impact + gain, sc.expected.combined), `${c.id}/${sc.id} combined ${impact + gain} != ${sc.expected.combined}`);
    }
  }
});

test('CUSTOM_CASES has one entry per new impact type with unique ids', () => {
  assert.equal(CUSTOM_CASES.length, 3);
  assert.equal(new Set(CUSTOM_CASES.map(c => c.id)).size, 3);
  assert.deepEqual(
    new Set(CUSTOM_CASES.map(c => c.id)),
    new Set(['expense', 'income', 'fx-bill'])
  );
  // custom cases must not collide with the worked examples
  const taken = new Set(CASES.map(c => c.id));
  for (const c of CUSTOM_CASES) assert.ok(!taken.has(c.id), `${c.id} collides with CASES`);
});

test('every custom case keeps the fixture interface with company null', () => {
  for (const c of CUSTOM_CASES) {
    assert.ok(c.title && typeof c.title === 'string', `${c.id} title`);
    assert.ok(c.samplePrompt && typeof c.samplePrompt === 'string', `${c.id} samplePrompt`);
    assert.ok(c.followUp && typeof c.followUp.question === 'string', `${c.id} followUp.question`);
    assert.ok(['choice', 'fields'].includes(c.followUp.kind), `${c.id} followUp.kind`);
    assert.ok(c.period && typeof c.period === 'string', `${c.id} period`);
    assert.ok(c.riskSummary && typeof c.riskSummary === 'string', `${c.id} riskSummary`);
    assert.strictEqual(c.company, null, `${c.id} company must be null (no real tickers)`);
    assert.equal(typeof c.defaultPosition, 'number', `${c.id} defaultPosition`);

    assert.ok(Array.isArray(c.inputs) && c.inputs.length > 0, `${c.id} inputs`);
    for (const f of c.inputs) {
      assert.ok(f.name && f.label, `${c.id} input name/label`);
      assert.ok('default' in f && 'unit' in f, `${c.id}/${f.name} default+unit`);
    }

    assert.ok(Array.isArray(c.scenarios) && c.scenarios.length >= 2, `${c.id} scenarios`);
    assert.equal(new Set(c.scenarios.map(s => s.id)).size, c.scenarios.length, `${c.id} scenario ids unique`);
    for (const sc of c.scenarios) {
      assert.ok(sc.label && sc.label.length > 0, `${c.id}/${sc.id} label`);
      assert.ok(sc.reason && sc.reason.length > 0, `${c.id}/${sc.id} reason`);
      assert.ok('returnPct' in sc, `${c.id}/${sc.id} returnPct`);
    }
  }
});

test('custom expense and income cases carry quantity/price fields and paper scenarios', () => {
  for (const c of CUSTOM_CASES.filter(c => c.impactType === 'expense' || c.impactType === 'income')) {
    const names = c.inputs.map(f => f.name);
    for (const n of ['quantity', 'baselinePrice', 'stressPrice']) {
      assert.ok(names.includes(n), `${c.id} missing input ${n}`);
    }
    // quantity defaults to 1 so it doubles as a lump total; real prices ship blank
    assert.equal(c.inputs.find(f => f.name === 'quantity').default, 1, `${c.id} quantity default`);
    assert.equal(c.inputs.find(f => f.name === 'baselinePrice').default, '', `${c.id} baselinePrice blank`);
    assert.equal(c.inputs.find(f => f.name === 'stressPrice').default, '', `${c.id} stressPrice blank`);

    for (const sc of c.scenarios) {
      assert.equal(sc.kind, 'paper', `${c.id}/${sc.id} kind`);
      assert.equal(typeof sc.returnPct, 'number', `${c.id}/${sc.id} numeric returnPct`);
      assert.match(sc.reason, /[Ss]ynthetic/, `${c.id}/${sc.id} flagged synthetic`);
    }
    assert.ok(c.scenarios.some(s => s.returnPct > 0), `${c.id} has a gain scenario`);
    assert.ok(c.scenarios.some(s => s.isFailure && s.returnPct < 0), `${c.id} has a failure scenario`);
  }
});

test('custom fx-bill case carries foreign-rate fields and a calculated benchmark', () => {
  const c = CUSTOM_CASES.find(c => c.impactType === 'fx-bill');
  assert.ok(c, 'fx-bill case exists');
  const names = c.inputs.map(f => f.name);
  for (const n of ['foreignDue', 'budgetRate', 'scenarioRate']) {
    assert.ok(names.includes(n), `fx-bill missing input ${n}`);
    assert.equal(c.inputs.find(f => f.name === n).default, '', `fx-bill ${n} blank`);
  }
  for (const n of ['budgetRate', 'scenarioRate']) {
    assert.match(c.inputs.find(f => f.name === n).unit, /per US dollar/, `fx-bill ${n} unit`);
  }

  const bench = c.scenarios.find(s => s.kind === 'foreign-cash');
  assert.ok(bench, 'fx-bill has a foreign-cash benchmark');
  assert.equal(bench.returnPct, 'calculated');
  const paper = c.scenarios.filter(s => s.kind === 'paper');
  assert.ok(paper.length >= 1, 'fx-bill has alternate synthetic paper scenario(s)');
  assert.ok(paper.some(s => s.isFailure && s.returnPct < 0), 'fx-bill has a failure scenario');
  for (const sc of paper) assert.match(sc.reason, /[Ss]ynthetic/, `fx-bill/${sc.id} flagged synthetic`);
});

test('custom case math: example inputs produce signed impacts and gains', async () => {
  const { unitCashImpact, foreignBillImpact, positionGain, yenBenchmarkGain } =
    await import('../src/engine.js');

  // expense: 400 units, $3.50 -> $4.50 is a $400 loss; +20% paper gains $200
  assert.ok(near(unitCashImpact(400, 3.50, 4.50, false), -400));
  assert.ok(near(positionGain(1000, 0.20), 200));
  assert.ok(near(positionGain(1000, -0.15), -150));

  // income: same numbers with the roles flipped
  assert.ok(near(unitCashImpact(400, 4.50, 3.50, true), -400));

  // fx-bill: mirrors the yen example, and the foreign-cash benchmark is calculated
  assert.ok(near(foreignBillImpact(600000, 150, 125), -800));
  assert.ok(near(yenBenchmarkGain(1000, 150, 125), 200));
});
