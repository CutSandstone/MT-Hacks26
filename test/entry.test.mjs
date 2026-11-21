import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../src/fixtures.js';
import { esc } from '../src/ui.js';

test('the entry screen offers exactly three offline branching surveys', async t => {
  const handlers = new Map();
  const focused = [];
  const app = {
    innerHTML: '',
    querySelector: sel => {
      if (sel === '#hedge-form [aria-invalid="true"]' && !app.innerHTML.includes('aria-invalid="true"')) return null;
      return { focus: () => { focused.push(sel); } };
    },
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const assumptions = {};
  const requests = [];
  t.mock.method(globalThis, 'fetch', async path => {
    requests.push(path);
    throw new TypeError('offline');
  });
  const oldDocument = globalThis.document;
  globalThis.document = { getElementById: id => id === 'app' ? app : assumptions };
  t.after(() => { globalThis.document = oldDocument; });

  await import('../src/app.js');
  const click = (action, data = {}) => handlers.get('click')({
    target: { closest: () => ({ dataset: { action, ...data } }) },
  });
  const submit = value => handlers.get('submit')({
    target: {
      id: 'survey-form',
      elements: { answer: { value: String(value), valueAsNumber: value === '' ? NaN : Number(value) } },
    },
    preventDefault: () => {},
  });
  const submitHedge = value => handlers.get('submit')({
    target: { id: 'hedge-form', elements: { namedItem: name => name === 'f-position' ? ({ value }) : null } },
    preventDefault: () => {},
  });
  const type = value => handlers.get('input')({ target: { id: 'survey-answer', value } });
  const answerInputs = () => (app.innerHTML.match(/name="answer"/g) || []).length;
  const answerValue = () => app.innerHTML.match(/id="survey-answer"[^>]*value="([^"]*)"/)[1];
  const cells = () => [...app.innerHTML.matchAll(/<td><span class="matrix-tile[^>]*>([^<]+)<\/span><\/td>/g)].map(m => m[1]);
  const rowHeads = () => [...app.innerHTML.matchAll(/scope="row">([^<]+)</g)].map(m => m[1]);
  const colHeads = () => [...app.innerHTML.matchAll(/scope="col">([^<]+)</g)].map(m => m[1]);
  const question = () => app.innerHTML.match(/id="survey-question"[^>]*>([^<]+)</)[1];

  const assertPicker = () => {
    assert.deepEqual([...app.innerHTML.matchAll(/data-action="pick" data-case="([^"]+)"/g)]
      .map(m => m[1]), ['cyber', 'car', 'yen']);
    assert.doesNotMatch(app.innerHTML, /<(textarea|input)\b/);
    assert.ok(app.innerHTML.includes('<h2 id="picker-title">Choose a scenario</h2>'), 'picker heading');
    assert.ok(app.innerHTML.includes('No account or real trades.'), 'no-real-trades note');
    for (const c of CASES) assert.ok(app.innerHTML.includes(esc(c.samplePrompt)), c.id);
    assert.equal(assumptions.hidden, false, 'assumptions footer visible on entry');
    assert.ok(assumptions.innerHTML.includes('Paper positions use unborrowed funds.'));
    assert.ok(assumptions.innerHTML.includes('<summary>How this simulation works</summary>'), 'footer details');
  };
  const assertResult = (c, { careerSwitch = false, showStock = false } = {}) => {
    for (const id of ['responses-title', 'verdict-title', 'matrix-title', 'reason-title']) {
      assert.ok(app.innerHTML.includes(`id="${id}"`), `${c.id} missing ${id}`);
    }
    assert.ok(app.innerHTML.includes('<h1 id="verdict-title" data-step-heading tabindex="-1" aria-describedby="verdict-explanation">'),
      `${c.id} verdict is an h1 with aria-describedby`);
    assert.ok(app.innerHTML.includes('>Compare outcomes</h2>'), `${c.id} matrix heading`);
    assert.ok(app.innerHTML.includes('>Why this result?</h2>'), `${c.id} reasoning heading`);
    assert.ok(!app.innerHTML.includes('Simulation assumptions'), `${c.id} shows assumptions`);
    assert.equal(assumptions.hidden, true, `${c.id} footer hidden`);
    assert.deepEqual(rowHeads(), ['With a hedge', 'Without a hedge'], `${c.id} matrix rows`);
    assert.deepEqual(colHeads(), careerSwitch
      ? ['Decision', 'Your role disappears', 'Your role remains']
      : {
          cyber: ['Decision', 'Hiring is delayed', 'Hiring stays on schedule'],
          car: ['Decision', 'Fuel price changes', 'Fuel price stays the same'],
          yen: ['Decision', 'Yen exchange rate changes', 'Yen exchange rate stays the same'],
        }[c.id], `${c.id} outcome columns`);
    assert.ok(!app.innerHTML.includes('tablist'), `${c.id} has no hedge tabs`);
    if (!showStock) assert.ok(!app.innerHTML.includes(esc(c.company.name)), `${c.id} hides company name`);
    assert.ok(!app.innerHTML.includes('Not recommended'), `${c.id} has real cells, no placeholder`);
  };
  const pick = id => click('pick', { case: id });
  const cyberDelay = () => click('followup', { opt: 'delay' });
  const cyber = CASES[0], car = CASES[1], yen = CASES[2];

  assertPicker();
  await pick('expense');
  assertPicker();

  // Cyber delay path: career worry choice first, then delay/pay/backup income.
  await pick('cyber');
  assert.ok(app.innerHTML.includes('<p id="survey-step">Question 1</p>'));
  assert.equal(answerInputs(), 0, 'career risk is a choice');
  assert.equal(question(), 'What are you worried could happen to your cybersecurity career?');
  await cyberDelay();
  assert.equal(question(), 'How many extra months might it take to land a cybersecurity job?');
  submit(2);
  assert.equal(question(), 'How much do you expect to earn per month in cybersecurity?');
  submit(4500);
  assert.equal(question(), 'Would you earn money in another job while you wait?');
  await click('followup', { opt: 'yes' });
  assert.ok(app.innerHTML.includes('Question 5 of 5'));
  assert.equal(question(), 'How much would you earn per month in another job while you wait?');
  assert.ok(app.innerHTML.includes('See results'));
  submit(3000);
  assertResult(cyber);
  assert.deepEqual(cells(), ['−$3,000.00', '$0.00', '−$3,000.00', '$0.00'], 'cyber backup-pay cells');
  assert.ok(app.innerHTML.includes('No hedge recommended'));
  assert.ok(app.innerHTML.includes('A stock can fall at the same time that hiring slows'), 'delay explains no stock hedge');
  assert.ok(!app.innerHTML.includes('id="hedge-form"'), 'cyber no hedge editor');
  // Edit responses: drafts kept; switching to "no paycheck" drops the salary step.
  await click('edit-answers');
  assert.equal(question(), 'What are you worried could happen to your cybersecurity career?');
  await cyberDelay();
  assert.equal(answerValue(), '2', 'delay preserved');
  submit(2);
  assert.equal(answerValue(), '4500', 'cyber pay preserved');
  submit(4500);
  await click('followup', { opt: 'no' });
  assertResult(cyber);
  assert.deepEqual(cells(), ['−$9,000.00', '$0.00', '−$9,000.00', '$0.00'], 'cyber no-backup cells (stale 3000 ignored)');
  assert.ok(!app.innerHTML.includes('Alternative job pay'), 'skipped salary absent from responses');
  await click('back');
  assertPicker();
  // No expected delay ends the survey immediately.
  await pick('cyber');
  await cyberDelay();
  submit(0);
  assertResult(cyber);
  assert.deepEqual(cells(), ['$0.00', '$0.00', '$0.00', '$0.00'], 'no delay is all zero');
  await click('back');
  assertPicker();

  // Cyber role-loss branch: stock surfaced only when the modeled offset qualifies.
  await pick('cyber');
  await click('followup', { opt: 'switch' });
  assert.equal(question(), 'How much do you expect to earn per month in cybersecurity?');
  submit(4500);
  assert.equal(question(), 'How much would you earn per month in the career you switch to?');
  submit(3000);
  assert.equal(question(), 'How many years of pay do you want to compare?');
  submit(5);
  assert.equal(question(), 'How much would you use for a hypothetical stock position?');
  submit(1000);
  assert.equal(question(), 'What stock return would you test if your cybersecurity role disappears?');
  submit(20);
  assert.equal(question(), 'What stock return would you test if your cybersecurity role remains?');
  assert.ok(app.innerHTML.includes('Use an illustrative total return over the whole period'));
  assert.ok(app.innerHTML.includes('See results'));
  submit(-10);
  assertResult(cyber, { careerSwitch: true, showStock: true });
  assert.ok(app.innerHTML.includes('Test Palo Alto Networks (PANW) as a possible offset'));
  assert.ok(app.innerHTML.includes('rel="noopener">Company source</a>'), 'company source shown');
  assert.deepEqual(cells(), ['−$89,800.00', '−$100.00', '−$90,000.00', '$0.00'], 'cyber switch stock cells');
  assert.ok(!app.innerHTML.includes('id="hedge-form"'), 'stock case has no yen editor');
  await click('back');
  assertPicker();
  // Same path with unfavorable stock assumptions: no stock name surfaces.
  await pick('cyber');
  await click('followup', { opt: 'switch' });
  submit(4500); submit(3000); submit(5); submit(1000); submit(-5); submit(-10);
  assertResult(cyber, { careerSwitch: true });
  assert.deepEqual(cells(), ['−$90,000.00', '$0.00', '−$90,000.00', '$0.00'], 'poor stock assumptions equalize rows');
  assert.ok(app.innerHTML.includes('No hedge recommended'));
  assert.ok(app.innerHTML.includes('No stock offset is shown unless'), 'rejection explains the gate');
  await click('back');
  assertPicker();
  // Replacement pay at or above cyber pay skips the stock questions entirely.
  await pick('cyber');
  await click('followup', { opt: 'switch' });
  submit(4500); submit(5000);
  assert.equal(question(), 'How many years of pay do you want to compare?', 'skips straight to horizon');
  submit(5);
  assertResult(cyber, { careerSwitch: true });
  assert.deepEqual(cells(), ['+$30,000.00', '$0.00', '+$30,000.00', '$0.00'], 'better replacement pay is a gain');
  assert.ok(!app.innerHTML.includes('Hypothetical stock position'), 'stock fields skipped');
  await click('back');
  assertPicker();

  // Car: invalid input stays; Back preserves drafts; driving choice branches.
  await pick('car');
  assert.equal(question(), 'How many miles will you drive this year?');
  assert.equal(answerValue(), '12000');
  submit('');
  assert.equal(question(), 'How many miles will you drive this year?', 'blank stays');
  assert.ok(app.innerHTML.includes('aria-invalid="true"'));
  submit(9000);
  type('42');
  await click('survey-back');
  assert.equal(answerValue(), '9000', 'submitted value preserved on Back');
  submit(9000);
  assert.equal(answerValue(), '42', 'input draft restored');
  submit(30);
  submit(3.50);
  assert.equal(question(), 'What price per gallon do you want to test?');
  submit(4.50);
  assert.equal(question(), 'Could you drive fewer miles if gas gets more expensive?');
  await click('followup', { opt: 'same' });
  assert.equal(question(), 'What kind of fuel-price increase do you want to test?', 'loss asks for a cause');
  await click('followup', { opt: 'other' });
  assertResult(car);
  assert.deepEqual(cells(), ['−$300.00', '$0.00', '−$300.00', '$0.00'], 'car same-mileage cells');
  assert.ok(app.innerHTML.includes('No hedge recommended'));
  assert.ok(app.innerHTML.includes('tax or fee'), 'non-margin cause explains no stock');
  await click('back');
  assertPicker();
  // Drive-less branch: over-usual mileage rejected, then reduced miles soften the impact.
  await pick('car');
  submit(12000); submit(30); submit(3.50); submit(4.50);
  await click('followup', { opt: 'less' });
  assert.equal(question(), 'How many miles would you drive at that higher price?');
  assert.ok(app.innerHTML.includes('Enter your estimated yearly miles, no more than your usual mileage.'));
  submit(13000);
  assert.equal(question(), 'How many miles would you drive at that higher price?', 'over-usual mileage stays');
  assert.ok(app.innerHTML.includes('aria-invalid="true"'));
  submit(11000);
  assert.equal(question(), 'What kind of fuel-price increase do you want to test?');
  await click('followup', { opt: 'other' });
  assertResult(car);
  assert.deepEqual(cells(), ['−$250.00', '$0.00', '−$250.00', '$0.00'], 'car reduced-mileage cells');
  // Driving less enough erases the loss: the fuel-cause question is skipped.
  await click('edit-answers');
  submit(12000); submit(30); submit(3.50); submit(4.50);
  await click('followup', { opt: 'less' });
  assert.ok(app.innerHTML.includes('Question 6'), 'scenarioMiles keeps plain numbering');
  assert.ok(app.innerHTML.includes('Continue'), 'branch field shows Continue');
  submit(9000);
  assertResult(car);
  assert.deepEqual(cells(), ['+$50.00', '$0.00', '+$50.00', '$0.00'], 'no residual fuel loss');
  assert.ok(!app.innerHTML.includes('Reason fuel prices rise'), 'skipped cause absent from responses');
  await click('back');
  assertPicker();
  // Tight-supply margin case surfaces the refinery stock offset.
  await pick('car');
  submit(12000); submit(30); submit(3.50); submit(4.50);
  await click('followup', { opt: 'same' });
  await click('followup', { opt: 'tight-supply' });
  assert.equal(question(), 'How much would you use for a hypothetical stock position?');
  submit(1000);
  assert.equal(question(), 'What stock return would you test if fuel prices rise and refining margins improve?');
  submit(15);
  assert.equal(question(), 'What stock return would you test if fuel prices stay the same?');
  submit(-10);
  assertResult(car, { showStock: true });
  assert.ok(app.innerHTML.includes('Test Valero (VLO) as a possible offset'));
  assert.ok(app.innerHTML.includes('rel="noopener">Company source</a>'));
  assert.deepEqual(cells(), ['−$250.00', '−$100.00', '−$400.00', '$0.00'], 'tight-supply stock cells');
  await click('back');
  assertPicker();
  // Same path with a flat modeled return: no stock is shown.
  await pick('car');
  submit(12000); submit(30); submit(3.50); submit(4.50);
  await click('followup', { opt: 'same' });
  await click('followup', { opt: 'tight-supply' });
  submit(1000); submit(0); submit(-10);
  assertResult(car);
  assert.deepEqual(cells(), ['−$400.00', '$0.00', '−$400.00', '$0.00'], 'zero-return stock equals cash');
  await click('back');
  assertPicker();

  // Yen: currency -> bill -> savings choice -> rates.
  await pick('yen');
  assert.ok(app.innerHTML.includes('<p id="survey-step">Question 1</p>'));
  assert.equal(answerInputs(), 0, 'currency choice has no numeric input');
  await click('followup', { opt: 'yen-invoice' });
  assert.equal(question(), 'How much tuition is due in yen?');
  submit(600000);
  assert.equal(question(), 'Have you already set aside any of this bill in yen?');
  await click('followup', { opt: 'no' });
  assert.ok(app.innerHTML.includes('Question 4 of 5'));
  submit(150);
  assert.ok(app.innerHTML.includes('Question 5 of 5'));
  assert.ok(app.innerHTML.includes('See results'));
  submit(125);
  assertResult(yen);
  assert.equal(focused.at(-1), '[data-step-heading]', 'result focuses the verdict heading');
  assert.deepEqual(cells(), ['−$600.00', '$0.00', '−$800.00', '$0.00'], 'yen default cells');
  assert.ok(app.innerHTML.includes('Consider holding yen for the bill'));
  assert.ok(app.innerHTML.includes('Adjust amount to convert'));
  submitHedge('500');
  assert.equal(focused.at(-1), '[data-step-heading]', 'valid hedge update focuses the updated verdict');
  assert.deepEqual(cells(), ['−$700.00', '$0.00', '−$800.00', '$0.00'], 'yen $500 conversion');
  submitHedge('5000');
  assert.deepEqual(cells(), ['Unknown', 'Unknown', '−$800.00', '$0.00'], 'yen over-budget conversion unknown');
  assert.ok(app.innerHTML.includes('aria-invalid="true"'), 'over-budget flagged');
  assert.equal(focused.at(-1), '#hedge-form [aria-invalid="true"]', 'invalid hedge update focuses the field');
  await click('back');
  assertPicker();
  // Yen already set aside: held > due rejected, partial held shrinks exposure.
  await pick('yen');
  await click('followup', { opt: 'yen-invoice' });
  submit(600000);
  await click('followup', { opt: 'yes' });
  assert.equal(question(), 'How much of the bill have you already set aside in yen?');
  assert.ok(app.innerHTML.includes('Include only yen already set aside for this bill.'));
  submit(700000);
  assert.equal(question(), 'How much of the bill have you already set aside in yen?', 'over-due held stays');
  assert.ok(app.innerHTML.includes('aria-invalid="true"'));
  submit(150000);
  assert.ok(app.innerHTML.includes('Question 5 of 6'));
  submit(150);
  submit(125);
  assertResult(yen);
  assert.deepEqual(cells(), ['−$400.00', '$0.00', '−$600.00', '$0.00'], 'yen partial-holdings cells');
  submitHedge('3100');
  assert.deepEqual(cells(), ['Unknown', 'Unknown', '−$600.00', '$0.00'], 'conversion over remaining balance unknown');
  await click('back');
  assertPicker();
  // Fully covered bill skips the rate questions and needs no conversion.
  await pick('yen');
  await click('followup', { opt: 'yen-invoice' });
  submit(600000);
  await click('followup', { opt: 'yes' });
  submit(600000);
  assertResult(yen);
  assert.deepEqual(cells(), ['$0.00', '$0.00', '$0.00', '$0.00'], 'fully covered is all zero');
  assert.ok(app.innerHTML.includes('No currency hedge needed'));
  assert.ok(!app.innerHTML.includes('id="hedge-form"'), 'covered bill has no hedge editor');
  await click('back');
  assertPicker();
  // Fixed USD: only the currency choice and the dollar amount.
  await pick('yen');
  await click('followup', { opt: 'usd-invoice' });
  assert.ok(app.innerHTML.includes('Question 2 of 2'));
  assert.equal(question(), 'How much tuition is due in US dollars?');
  assert.ok(app.innerHTML.includes('See results'));
  submit(4000);
  assertResult(yen);
  assert.deepEqual(cells(), ['$0.00', '$0.00', '$0.00', '$0.00'], 'fixed-bill cells');
  assert.ok(app.innerHTML.includes('No currency hedge needed'));
  await click('back');
  assertPicker();
  // Favorable rate move shows no loss and no hedge.
  await pick('yen');
  await click('followup', { opt: 'yen-invoice' });
  submit(600000);
  await click('followup', { opt: 'no' });
  submit(150);
  submit(160);
  assertResult(yen);
  assert.deepEqual(cells(), ['+$250.00', '$0.00', '+$250.00', '$0.00'], 'favorable-rate cells');
  assert.ok(app.innerHTML.includes('No hedge recommended'));
  assert.ok(!app.innerHTML.includes('id="hedge-form"'), 'favorable rates have no hedge editor');
  await click('back');
  assertPicker();

  assert.deepEqual(requests, []);
});
