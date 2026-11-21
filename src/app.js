import {
  careerImpact, commutingImpact, tuitionImpactYen, tuitionImpactFixedDollar,
  positionGain, yenBenchmarkReturnDecimal, combinedChange, validateField, roundCents,
} from './engine.js';
import { CASES, ASSUMPTIONS } from './fixtures.js';
import { entryHTML } from './entry.js';
import { esc, fmtUSD, fmtSignedUSD, fieldHTML } from './ui.js';

const app = document.getElementById('app');

const QUESTIONS = {
  extraMonths: 'How many extra months might it take to land a cybersecurity job?',
  cyberMonthlyPay: 'How much do you expect to earn per month in cybersecurity?',
  alternativeMonthlyPay: 'How much would you earn per month in another job while you wait?',
  annualMiles: 'How many miles will you drive this year?',
  mpg: 'How many miles can your car drive on one gallon of gas?',
  budgetPrice: 'What do you expect to pay for a gallon of gas?',
  scenarioPrice: 'What price per gallon do you want to test?',
  yenDue: 'How much tuition is due in yen?',
  budgetRate: 'How many yen do you expect to get for one US dollar?',
  scenarioRate: 'How many yen per US dollar do you want to test?',
  fixedBillUsd: 'How much tuition is due in US dollars?',
  scenarioMiles: 'How many miles would you drive at that higher price?',
  yenHeld: 'How much of the bill have you already set aside in yen?',
  replacementMonthlyPay: 'How much would you earn per month in the career you switch to?',
  switchYears: 'How many years of pay do you want to compare?',
  stockAmount: 'How much would you use for a hypothetical stock position?',
  stockSwitchReturn: 'What stock return would you test if your cybersecurity role disappears?',
  stockStayReturn: 'What stock return would you test if your cybersecurity role remains?',
  stockFuelReturn: 'What stock return would you test if fuel prices rise and refining margins improve?',
  stockStableFuelReturn: 'What stock return would you test if fuel prices stay the same?',
};

const STOCK_AMOUNT = { name: 'stockAmount', label: 'Hypothetical stock position', default: 1000, unit: '$' };

const EXTRA_FIELDS = {
  cyber: [
    { name: 'replacementMonthlyPay', label: 'Replacement career pay', default: 3000, unit: 'US dollars per month' },
    { name: 'switchYears', label: 'Pay comparison period', default: 5, unit: 'years' },
    STOCK_AMOUNT,
    { name: 'stockSwitchReturn', label: 'Stock return if role disappears', default: 20, unit: '%' },
    { name: 'stockStayReturn', label: 'Stock return if role remains', default: -10, unit: '%' },
  ],
  car: [
    { name: 'scenarioMiles', label: 'Miles at the higher price', default: '', unit: 'miles' },
    STOCK_AMOUNT,
    { name: 'stockFuelReturn', label: 'Stock return if fuel gets more expensive', default: 15, unit: '%' },
    { name: 'stockStableFuelReturn', label: 'Stock return if fuel prices stay the same', default: -10, unit: '%' },
  ],
  yen: [{ name: 'yenHeld', label: 'Tuition already set aside', default: 0, unit: '¥' }],
};

const CHOICE_STEPS = {
  careerRisk: {
    id: 'careerRisk', label: 'Career risk', title: 'What are you worried could happen to your cybersecurity career?',
    options: [{ id: 'delay', label: 'It takes longer to get a job' }, { id: 'switch', label: 'My role disappears and I have to switch careers' }],
  },
  backupPay: {
    id: 'backupPay', label: 'Income while waiting', title: 'Would you earn money in another job while you wait?',
    options: [{ id: 'yes', label: 'Yes, I would have another paycheck' }, { id: 'no', label: 'No, I would not earn anything' }],
  },
  driving: {
    id: 'driving', label: 'Driving plan', title: 'Could you drive fewer miles if gas gets more expensive?',
    options: [{ id: 'less', label: 'Yes, I could drive less' }, { id: 'same', label: 'No, my mileage would stay the same' }],
  },
  savings: {
    id: 'savings', label: 'Yen already set aside', title: 'Have you already set aside any of this bill in yen?',
    options: [{ id: 'yes', label: 'Yes, I already have some yen for it' }, { id: 'no', label: 'No, I still need to buy the yen' }],
  },
  fuelDriver: {
    id: 'fuelDriver', label: 'Reason fuel prices rise', title: 'What kind of fuel-price increase do you want to test?',
    options: [
      { id: 'tight-supply', label: 'Tight gasoline supply lets refiners earn more' },
      { id: 'other', label: 'A local tax, fee, or another cause' },
    ],
  },
};

const BRANCH_FIELDS = new Set(['extraMonths', 'scenarioPrice', 'scenarioMiles', 'yenDue', 'yenHeld',
  'replacementMonthlyPay', 'stockAmount']);

const OUTCOME_LABELS = {
  cyber: ['Hiring is delayed', 'Hiring stays on schedule'],
  car: ['Fuel price changes', 'Fuel price stays the same'],
  yen: ['Yen exchange rate changes', 'Yen exchange rate stays the same'],
};

const state = {
  screen: 'entry',          // 'entry' | 'survey' | 'result'
  caseId: null,
  questionIndex: 0,
  choices: {},
  inputs: {},               // name -> raw string
  errors: {},               // name -> message
  position: null,
  settingsOpen: false,
};

const caseById = id => CASES.find(c => c.id === id);
const isFixedUsd = c => c.id === 'yen' && state.choices.currency === 'usd-invoice';
const isCareerSwitch = c => c.id === 'cyber' && state.choices.careerRisk === 'switch';

function initCase(c) {
  state.caseId = c.id;
  state.choices = {};
  state.inputs = {};
  for (const f of c.inputs) state.inputs[f.name] = String(f.default);
  if (c.fixedMode) for (const f of c.fixedMode.inputs) state.inputs[f.name] = String(f.default);
  for (const f of EXTRA_FIELDS[c.id]) state.inputs[f.name] = String(f.default);
  state.errors = {};
  state.position = null;
  state.settingsOpen = false;
  state.questionIndex = 0;
  state.screen = 'survey';
}

function num(name) {
  const v = parseFloat(state.inputs[name]);
  return Number.isNaN(v) ? NaN : v;
}

function remainingYen() {
  const held = state.choices.savings === 'yes' ? num('yenHeld') : 0;
  return Math.max(0, num('yenDue') - held);
}

function surveyFlow(c) {
  const number = name => ({
    field: [...c.inputs, ...(c.fixedMode?.inputs || []), ...EXTRA_FIELDS[c.id]].find(f => f?.name === name),
  });
  const { choices } = state;
  if (c.id === 'cyber') {
    const steps = [CHOICE_STEPS.careerRisk];
    if (!choices.careerRisk) return { steps, pending: true };
    if (isCareerSwitch(c)) {
      steps.push(number('cyberMonthlyPay'), number('replacementMonthlyPay'), number('switchYears'));
      if (num('cyberMonthlyPay') > num('replacementMonthlyPay')) {
        steps.push(number('stockAmount'));
        if (num('stockAmount') > 0) steps.push(number('stockSwitchReturn'), number('stockStayReturn'));
      }
      return { steps, pending: false };
    }
    steps.push(number('extraMonths'));
    if (num('extraMonths') === 0) return { steps, pending: false };
    steps.push(number('cyberMonthlyPay'), CHOICE_STEPS.backupPay);
    if (choices.backupPay === 'yes') steps.push(number('alternativeMonthlyPay'));
    return { steps, pending: !choices.backupPay };
  }
  if (c.id === 'car') {
    const steps = ['annualMiles', 'mpg', 'budgetPrice', 'scenarioPrice'].map(number);
    if (num('scenarioPrice') <= num('budgetPrice')) return { steps, pending: false };
    steps.push(CHOICE_STEPS.driving);
    if (!choices.driving) return { steps, pending: true };
    if (choices.driving === 'less') steps.push(number('scenarioMiles'));
    if (roundCents(computeImpact(c)) < 0) {
      steps.push(CHOICE_STEPS.fuelDriver);
      if (!choices.fuelDriver) return { steps, pending: true };
      if (choices.fuelDriver === 'tight-supply') {
        steps.push(number('stockAmount'));
        if (num('stockAmount') > 0) steps.push(number('stockFuelReturn'), number('stockStableFuelReturn'));
      }
    }
    return { steps, pending: false };
  }
  const steps = [{ id: 'currency', label: 'Bill currency', title: c.followUp.question, options: c.followUp.options }];
  if (!choices.currency) return { steps, pending: true };
  if (isFixedUsd(c)) return { steps: [...steps, number('fixedBillUsd')], pending: false };
  steps.push(number('yenDue'));
  if (num('yenDue') === 0) return { steps, pending: false };
  steps.push(CHOICE_STEPS.savings);
  if (!choices.savings) return { steps, pending: true };
  if (choices.savings === 'yes') steps.push(number('yenHeld'));
  if (remainingYen() > 0) steps.push(number('budgetRate'), number('scenarioRate'));
  return { steps, pending: false };
}

function computeImpact(c) {
  if (isFixedUsd(c)) return tuitionImpactFixedDollar();
  switch (c.impactType) {
    case 'career': {
      if (isCareerSwitch(c)) {
        return careerImpact(12 * num('switchYears'), num('cyberMonthlyPay') - num('replacementMonthlyPay'));
      }
      const delay = num('extraMonths');
      const backupPay = state.choices.backupPay === 'yes' ? num('alternativeMonthlyPay') : 0;
      return delay === 0 ? 0 : careerImpact(delay, num('cyberMonthlyPay') - backupPay);
    }
    case 'commute': {
      const miles = num('annualMiles');
      const mpg = num('mpg');
      const budget = num('budgetPrice');
      const price = num('scenarioPrice');
      const impact = commutingImpact(miles, mpg, budget, price);
      return price > budget && state.choices.driving === 'less'
        ? impact + (miles - num('scenarioMiles')) / mpg * price : impact;
    }
    case 'tuition-yen': {
      const remaining = remainingYen();
      return remaining === 0 ? 0 : tuitionImpactYen(remaining, num('budgetRate'), num('scenarioRate'));
    }
    default: return 0;
  }
}

function renderSurvey() {
  const c = caseById(state.caseId);
  const index = state.questionIndex;
  const { steps, pending } = surveyFlow(c);
  const { field, title: prompt, id, options } = steps[index];
  const total = steps.length;
  const branching = pending || BRANCH_FIELDS.has(field?.name);
  const step = branching ? `Question ${index + 1}` : `Question ${index + 1} of ${total}`;
  const title = field ? QUESTIONS[field.name] : prompt;
  const error = field && state.errors[field.name];
  const segments = Array.from({ length: total }, (_, i) =>
    `<span class="${i < index ? 'done' : i === index ? 'current' : ''}"></span>`).join('');
  const back = `<button type="button" class="ghost" data-action="survey-back">${index === 0 ? 'Change scenario' : 'Back'}</button>`;
  const hint = field?.name === 'scenarioMiles' ? 'Enter your estimated yearly miles, no more than your usual mileage.'
    : field?.name === 'yenHeld' ? 'Include only yen already set aside for this bill.'
      : field?.name === 'stockAmount' ? 'This is a simulated investment, not a recommendation. Enter 0 to skip it.'
        : field?.unit === '%' ? 'Use an illustrative total return over the whole period, not a yearly return. Enter a negative number to model a loss.'
          : 'Use the example value or enter your own.';
  app.innerHTML = `<section class="survey" aria-labelledby="survey-question">
    <div class="survey-meta">
      <p>${esc(c.title)}</p>
      <p id="survey-step">${step}</p>
    </div>
    <div class="survey-progress${branching ? ' pending' : ''}" aria-hidden="true">${segments}</div>
    <h1 id="survey-question" data-step-heading tabindex="-1" aria-describedby="survey-step">${esc(title)}</h1>
    ${field ? `<form class="survey-form" id="survey-form" novalidate>
      <label id="survey-unit" for="survey-answer">${esc(field.unit)}</label>
      <input id="survey-answer" name="answer" type="number" step="any" inputmode="decimal"
        aria-labelledby="survey-question" aria-describedby="survey-unit survey-hint${error ? ' survey-error' : ''}"
        ${error ? 'aria-invalid="true"' : ''} value="${esc(state.inputs[field.name])}">
      <p id="survey-hint" class="survey-hint">${hint}</p>
      ${error ? `<p id="survey-error" class="survey-error">${esc(error)}</p>` : ''}
      <div class="survey-actions">
        <button type="submit" class="primary">${!branching && index + 1 === total ? 'See results' : 'Continue'}</button>
        ${back}
      </div>
    </form>` : `<div class="choices survey-choices">${options.map(o =>
      `<button type="button" class="choice-btn ${state.choices[id] === o.id ? 'selected' : ''}" data-action="followup" data-opt="${esc(o.id)}">${esc(o.label)}${state.choices[id] === o.id ? ' <span class="sr-only">Previously selected.</span>' : ''}</button>`).join('')}
    </div>
    <div class="survey-actions">${back}</div>`}
  </section>`;
}

function resultHTML(c) {
  const fixed = isFixedUsd(c);
  const careerSwitch = isCareerSwitch(c);
  const [changed, unchanged] = careerSwitch ? ['Your role disappears', 'Your role remains'] : OUTCOME_LABELS[c.id];
  const cols = [{ label: changed, impact: computeImpact(c) }, { label: unchanged, impact: 0 }];
  const loss = roundCents(cols[0].impact) < 0;
  const covered = c.id === 'yen' && !fixed && remainingYen() === 0;
  const yenHedge = c.id === 'yen' && !fixed && loss;
  const carStock = c.id === 'car' && state.choices.fuelDriver === 'tight-supply';
  const stockAmount = careerSwitch || carStock ? num('stockAmount') : 0;
  const riskGain = positionGain(stockAmount, num(careerSwitch ? 'stockSwitchReturn' : 'stockFuelReturn') / 100);
  const quietGain = positionGain(stockAmount, num(careerSwitch ? 'stockStayReturn' : 'stockStableFuelReturn') / 100);
  const stockHedge = (careerSwitch || carStock) && loss && stockAmount > 0 && roundCents(riskGain) > 0 && riskGain > quietGain;
  const recommended = yenHedge || stockHedge;
  const maxPosition = yenHedge ? remainingYen() / num('budgetRate') : 0;
  const rawPosition = state.position ?? String(Math.min(c.defaultPosition, maxPosition));
  const pos = parseFloat(rawPosition);
  const posError = yenHedge && (validateField('position', pos) ||
    (pos === 0 ? 'Enter an amount greater than $0.' :
      pos > maxPosition ? 'Enter no more than the budgeted dollar cost of your bill.' : null));
  if (yenHedge) {
    const rate = yenBenchmarkReturnDecimal(num('budgetRate'), num('scenarioRate'));
    cols[0].total = combinedChange(cols[0].impact, posError ? null : positionGain(pos, rate));
    cols[1].total = posError ? null : 0;
  }
  if (stockHedge) {
    cols[0].total = combinedChange(cols[0].impact, riskGain);
    cols[1].total = quietGain;
  }
  const money = n => n === null ? 'Unknown' : fmtSignedUSD(roundCents(n));
  const responseRows = surveyFlow(c).steps.map(({ field: f, id, label, options }) => {
    if (!f) return `<div><dt>${esc(label)}</dt><dd>${esc(options.find(o => o.id === state.choices[id]).label)}</dd></div>`;
    const value = num(f.name);
    const digits = value.toLocaleString('en-US', { maximumFractionDigits: 10 });
    const answer = f.unit === '$' ? fmtUSD(value)
      : f.unit === '¥' ? `¥${digits}`
      : f.unit === '$/gal' ? `${fmtUSD(value)} per gallon`
      : f.unit === 'US dollars per month' ? `${fmtUSD(value)} per month`
      : f.unit === '%' ? `${digits}%`
      : `${digits} ${f.unit === 'mpg' ? 'miles per gallon' : f.unit}`;
    return `<div><dt>${esc(f.label)}</dt><dd>${esc(answer)}</dd></div>`;
  }).join('');
  const stockName = `${c.company.name} (${c.company.ticker})`;
  const action = fixed || covered ? 'No currency hedge needed'
    : yenHedge ? 'Consider holding yen for the bill'
      : stockHedge ? `Test ${stockName} as a possible offset` : 'No hedge recommended';
  const explanation = fixed ? c.fixedMode.message : covered ? 'There is no unpaid yen balance to protect.'
    : stockHedge ? `Under your assumptions, the position earns ${fmtUSD(riskGain)} ${careerSwitch ? 'if your role disappears' : 'if fuel prices rise'}. The modeled ${careerSwitch ? 'earnings' : 'fuel-cost'} change without it is ${money(cols[0].impact)}.`
      : yenHedge
        ? posError ? 'Enter a valid amount to see how much holding yen could offset.'
          : `At these exchange rates, holding yen changes the modeled result from ${money(cols[0].impact)} to ${money(cols[0].total)}.`
        : loss ? 'The available hedge does not reliably offset this cost in the examples shown.'
          : 'Your answers show no modeled loss to offset.';
  const reasoning = fixed ? 'Your bill is already in US dollars, so changes in the yen do not change what you owe.'
    : covered ? 'An exchange-rate change only affects the part of your tuition that you still need to buy yen for.'
    : stockHedge ? (careerSwitch
        ? 'Demand for AI-assisted security tools could rise as some roles disappear, but stock prices can fall even if that happens. The result uses your assumed returns, not a forecast or a recommendation to buy.'
        : 'Tight gasoline supply can lift refining margins, but a refinery stock does not track the pump price. The result uses your assumed returns, not a forecast or a recommendation to buy.')
    : careerSwitch ? 'A permanent switch changes your pay over the years you entered. No stock offset is shown unless the assumptions produce a positive gain that is larger when your role disappears than when it remains.'
    : yenHedge ? 'Holding yen matches the currency of your bill. Only the yen you still need to buy is exposed to exchange-rate changes.'
      : c.id === 'cyber' ? num('extraMonths') === 0 ? 'You entered no delay, so there is no missed pay in this comparison.'
          : state.choices.backupPay === 'yes' ? 'The income from your other job reduces the pay you miss during the delay. A stock can fall at the same time that hiring slows, so it does not reliably cover that gap.'
            : 'Without another paycheck, the delay costs the full amount of pay you would have earned. A stock can fall at the same time that hiring slows, so it does not reliably cover that gap.'
        : c.id === 'car' ? loss && state.choices.fuelDriver === 'other'
            ? 'A tax or fee can raise what you pay without improving refinery margins, so this model does not show a refining-stock hedge for that outcome.'
            : num('scenarioPrice') > num('budgetPrice') && state.choices.driving === 'less'
              ? 'The higher-price outcome includes your reduced mileage. It compares fuel spending only, not the cost of other transportation.'
              : 'Fuel prices can rise without a matching gain elsewhere. Allow room for higher pump prices in your budget.'
          : 'At the exchange rates you entered, your yen bill costs no more than you budgeted in US dollars.';
  const positionField = yenHedge ? fieldHTML({ name: 'position', label: 'Amount to convert to yen', unit: 'US dollars', value: rawPosition, error: posError }) : '';
  const magnitude = Math.max(0, ...cols.flatMap(({ impact, total }) => [impact, total])
    .filter(Number.isFinite).map(Math.abs));
  const cells = key => cols.map(col => {
    const value = key === 'total' && !recommended ? col.impact : col[key];
    const known = Number.isFinite(value);
    const rounded = known ? roundCents(value) : 0;
    const tone = !known ? 'unknown' : rounded > 0 ? 'gain' : rounded < 0 ? 'loss' : 'even';
    const heat = tone === 'gain' || tone === 'loss'
      ? ` style="--matrix-heat:${18 + 32 * Math.abs(value) / magnitude}%"` : '';
    return `<td><span class="matrix-tile ${tone}"${heat}>${money(known ? value : null)}</span></td>`;
  }).join('');
  return `<div class="results">
    <section class="result-section verdict" aria-labelledby="verdict-title">
      <p class="result-context">${esc(c.title)}</p>
      <h1 id="verdict-title" data-step-heading tabindex="-1" aria-describedby="verdict-explanation">${esc(action)}</h1>
      <p id="verdict-explanation">${esc(explanation)}</p>
    </section>
    <section class="result-section" aria-labelledby="matrix-title">
      <h2 id="matrix-title">Compare outcomes</h2>
      <p id="matrix-caption" class="muted small">Change from your budget or expected pay, in US dollars. ${stockHedge ? `A ${fmtUSD(stockAmount)} paper position in ${esc(stockName)} is compared with keeping that money in cash. The stock returns are hypothetical.${careerSwitch ? ' The pay comparison assumes flat monthly pay and does not account for taxes, wage growth or discounting.' : ''}` : yenHedge ? (posError ? 'Enter a valid amount to compare holding yen with US-dollar cash.' : `Hedging uses ${fmtUSD(pos)} to buy yen; not hedging leaves that amount in US-dollar cash.`) : 'No hedge is modeled for your answers, so both rows show the same outcome.'} Outcomes are hypothetical.</p>
      <div class="matrix-scroll" role="region" aria-labelledby="matrix-title" tabindex="0">
        <table class="scenario-matrix" aria-labelledby="matrix-title" aria-describedby="matrix-caption matrix-key">
          <thead><tr><th scope="col">Decision</th>${cols.map(({ label }) => `<th scope="col">${esc(label)}</th>`).join('')}</tr></thead>
          <tbody><tr><th scope="row">With a hedge</th>${cells('total')}</tr><tr><th scope="row">Without a hedge</th>${cells('impact')}</tr></tbody>
        </table>
      </div>
      <p id="matrix-key" class="matrix-key">A minus sign means a loss; a plus sign means a gain. Darker color indicates a larger change.</p>
      ${yenHedge ? `<details${state.settingsOpen ? ' open' : ''} class="hedge-settings">
        <summary>Adjust amount to convert</summary>
        <form id="hedge-form" novalidate>
          <div class="field-grid">${positionField}</div>
          <p class="muted small">Do not convert more than you still need for the bill.</p>
          <button type="submit" class="primary">Update comparison</button>
        </form>
      </details>` : ''}
    </section>
    <section class="result-section" aria-labelledby="reason-title">
      <h2 id="reason-title">Why this result?</h2>
      <p>${esc(reasoning)}</p>
      ${stockHedge ? `<p>${esc(c.company.fact)} <a href="${esc(c.company.sources[0].url)}" target="_blank" rel="noopener">Company source</a></p>` : ''}
    </section>
    <section class="result-section" aria-labelledby="responses-title">
      <h2 id="responses-title">Your responses</h2>
      <dl class="response-list">${responseRows}</dl>
      <div class="row"><button type="button" class="ghost" data-action="edit-answers">Edit responses</button>
        <button type="button" class="ghost" data-action="back">Change scenario</button></div>
    </section>
  </div>`;
}

function render() {
  if (state.screen === 'entry') app.innerHTML = entryHTML();
  else if (state.screen === 'survey') renderSurvey();
  else app.innerHTML = resultHTML(caseById(state.caseId));
  const footer = document.getElementById('assumptions');
  footer.hidden = state.screen !== 'entry';
  footer.innerHTML =
    `<details><summary>How this simulation works</summary><ul>${ASSUMPTIONS.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>`;
}

function renderStep(focus = '[data-step-heading]') {
  render();
  (app.querySelector(focus) ?? app.querySelector('[data-step-heading]'))?.focus();
}

function advanceSurvey(c) {
  if (state.questionIndex + 1 >= surveyFlow(c).steps.length) state.screen = 'result';
  else state.questionIndex++;
  renderStep();
}

// ---------- events ----------

app.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const c = state.caseId ? caseById(state.caseId) : null;
  switch (btn.dataset.action) {
    case 'pick': {
      const selected = caseById(btn.dataset.case);
      if (!selected) return;
      initCase(selected);
      return renderStep();
    }
    case 'followup': {
      if (state.screen !== 'survey') return;
      const { id, options } = surveyFlow(c).steps[state.questionIndex];
      if (!options?.some(o => o.id === btn.dataset.opt)) return;
      state.choices[id] = btn.dataset.opt;
      return advanceSurvey(c);
    }
    case 'survey-back':
      state.errors = {};
      if (state.questionIndex === 0) state.screen = 'entry';
      else state.questionIndex--;
      return renderStep();
    case 'back':
      state.screen = 'entry';
      return renderStep();
    case 'edit-answers':
      state.questionIndex = 0;
      state.errors = {};
      state.screen = 'survey';
      return renderStep();
  }
  render();
});

app.addEventListener('input', e => {
  if (state.screen !== 'survey' || e.target.id !== 'survey-answer') return;
  const c = caseById(state.caseId);
  const { field } = surveyFlow(c).steps[state.questionIndex];
  if (field) state.inputs[field.name] = e.target.value;
});

app.addEventListener('submit', e => {
  if (state.screen === 'result' && e.target.id === 'hedge-form') {
    e.preventDefault();
    state.position = e.target.elements.namedItem('f-position').value;
    state.settingsOpen = true;
    return renderStep('#hedge-form [aria-invalid="true"]');
  }
  if (state.screen !== 'survey' || e.target.id !== 'survey-form') return;
  e.preventDefault();
  const c = caseById(state.caseId);
  const { field } = surveyFlow(c).steps[state.questionIndex];
  if (!field) return;
  const answer = e.target.elements.answer;
  state.inputs[field.name] = answer.value;
  const value = answer.valueAsNumber;
  const rule = field.name === 'stockAmount' ? 'position' : field.unit === '%' ? 'returnPct' : field.name;
  const error = validateField(rule, value) ||
    (field.name === 'scenarioMiles' && value > num('annualMiles') ? 'Enter no more than your usual yearly mileage.' :
      field.name === 'yenHeld' && value > num('yenDue') ? 'Enter no more than the total tuition due.' : null);
  state.errors = error ? { [field.name]: error } : {};
  if (error) return renderStep('#survey-answer');
  advanceSurvey(c);
});

render();
