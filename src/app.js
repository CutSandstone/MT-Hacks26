import {
  careerImpact, commutingImpact, tuitionImpactYen, tuitionImpactFixedDollar,
  unitCashImpact, foreignBillImpact, positionGain, yenBenchmarkReturnDecimal, yenBenchmarkGain,
  combinedChange, breakEvenPosition, breakEvenReturn, classifyOutcome, validateField, roundCents,
} from './engine.js';
import { CASES, CUSTOM_CASES, ASSUMPTIONS, SCOPE_MESSAGE } from './fixtures.js';
import { matchSample, suggestCases } from './matcher.js';
import { esc, fmtUSD, fmtSignedUSD, fmtPct, outcomeText, fieldHTML } from './ui.js';
import { inferenceStatus, providerLabel, interpretDecision, askAbout } from './ai.js';

const ALL_CASES = [...CASES, ...CUSTOM_CASES];

const app = document.getElementById('app');

const CASH_KINDS = new Set(['yen-cash', 'foreign-cash']);
const isCashKind = k => CASH_KINDS.has(k);

const state = {
  screen: 'entry',          // 'entry' | 'confirm' | 'result'
  caseId: null,
  promptText: '',
  promptEcho: '',           // typed text shown back on confirm/result
  entryMessage: null,       // 'ambiguous' | 'unsupported' | 'unavailable'
  suggestions: [],          // case ids offered as manual picks after a miss
  followUpChoice: null,
  inputs: {},               // name -> raw string
  supplied: new Set(),      // input names the model extracted from the text
  errors: {},               // name -> message
  scenarioId: null,
  position: '1000',
  returnPct: '',            // raw percent string for stock/paper scenarios
  returnUnknown: false,
  showFailure: false,
  inference: { provider: 'devin', configured: false, model: '' },
  matchSource: null,        // 'ai' | 'sample'
  matching: false,
  matchSeq: 0,              // stale-response guard for /api/interpret
  horizon: '',              // editable period label for custom templates
  unitLabel: '',            // editable currency/unit label for custom templates
  ask: { question: '', answer: null, loading: false },
};

const caseById = id => ALL_CASES.find(c => c.id === id);
const scenarioById = (c, id) => c.scenarios.find(s => s.id === id);
const isFixedUsd = c => c.id === 'yen' && state.followUpChoice === 'usd-invoice';
const isCustom = c => !!c && !c.company;
const periodText = c => (isCustom(c) ? (state.horizon || c.period) : c.period);

function defaultUnitLabel(c) {
  if (!c || c.company) return '';
  const key = c.impactType === 'fx-bill' ? 'foreignDue' : 'quantity';
  const f = c.inputs.find(x => x.name === key);
  return (f && f.unit) || (c.impactType === 'fx-bill' ? 'foreign currency' : 'units');
}

function initCase(caseId) {
  const c = caseById(caseId);
  state.caseId = caseId;
  state.followUpChoice = null;
  state.inputs = {};
  for (const f of c.inputs) state.inputs[f.name] = String(f.default);
  if (c.fixedMode) for (const f of c.fixedMode.inputs) state.inputs[f.name] = String(f.default);
  if (c.followUp.inputs) for (const f of c.followUp.inputs) state.inputs[f.name] = String(f.default);
  state.supplied = new Set();
  state.errors = {};
  state.showFailure = false;
  state.scenarioId = c.scenarios[0].id;
  state.position = String(c.defaultPosition);
  const first = c.scenarios[0];
  state.returnPct = String(first.returnPct === 'calculated' ? '' : first.returnPct);
  state.returnUnknown = false;
  state.screen = 'confirm';
  state.entryMessage = null;
  state.suggestions = [];
  state.matching = false;
  state.matchSource = null;
  state.promptEcho = '';
  state.horizon = c.period || '';
  state.unitLabel = defaultUnitLabel(c);
  state.ask = { question: '', answer: null, loading: false };
}

function num(name) {
  const v = parseFloat(state.inputs[name]);
  return Number.isNaN(v) ? NaN : v;
}

function activeInputs(c) {
  return isFixedUsd(c) ? c.fixedMode.inputs : c.inputs;
}

// Display unit for a field; custom templates let the user rename the unit/currency.
function displayUnit(c, f) {
  if (!isCustom(c)) return f.unit;
  const u = state.unitLabel || f.unit;
  if (c.impactType === 'fx-bill') {
    if (f.name === 'foreignDue') return u;
    if (f.name === 'budgetRate' || f.name === 'scenarioRate') return `${u} per US dollar`;
  }
  if (f.name === 'quantity') return u;
  if (f.name === 'baselinePrice' || f.name === 'stressPrice') return `USD per ${u}`;
  return f.unit;
}

function computeImpact(c, scenario) {
  if (isFixedUsd(c)) return tuitionImpactFixedDollar();
  const g = n => num(n);
  const over = (scenario && scenario.impactOverride) || {};
  const val = n => (n in over ? over[n] : g(n));
  switch (c.impactType) {
    case 'career': return careerImpact(val('extraMonths'), val('monthlyEarningsDiff'));
    case 'commute': return commutingImpact(val('annualMiles'), val('mpg'), val('budgetPrice'), val('scenarioPrice'));
    case 'tuition-yen': return tuitionImpactYen(val('yenDue'), val('budgetRate'), val('scenarioRate'));
    case 'expense': return unitCashImpact(val('quantity'), val('baselinePrice'), val('stressPrice'), false);
    case 'income': return unitCashImpact(val('quantity'), val('baselinePrice'), val('stressPrice'), true);
    case 'fx-bill': return foreignBillImpact(val('foreignDue'), val('budgetRate'), val('scenarioRate'));
    default: return 0;
  }
}

function computeGain(c, scenario) {
  const position = parseFloat(state.position);
  if (Number.isNaN(position)) return null;
  if (isCashKind(scenario.kind)) {
    return yenBenchmarkGain(position, num('budgetRate'), num('scenarioRate'));
  }
  if (state.returnUnknown) return positionGain(position, null);
  const r = parseFloat(state.returnPct);
  if (Number.isNaN(r)) return null;
  return positionGain(position, r / 100);
}

function currentReturnDecimal(c, scenario) {
  if (isCashKind(scenario.kind)) {
    const b = num('budgetRate'), s = num('scenarioRate');
    if (b > 0 && s > 0) return yenBenchmarkReturnDecimal(b, s);
    return null;
  }
  if (state.returnUnknown) return null;
  const r = parseFloat(state.returnPct);
  return Number.isNaN(r) ? null : r / 100;
}

function validateAll(c) {
  state.errors = {};
  for (const f of activeInputs(c)) {
    const msg = validateField(f.name, num(f.name));
    if (msg) state.errors[f.name] = msg;
  }
  const posMsg = validateField('position', parseFloat(state.position));
  if (posMsg) state.errors.position = posMsg;
  const sc = scenarioById(c, state.scenarioId);
  if (sc && !isCashKind(sc.kind) && !state.returnUnknown) {
    const rMsg = validateField('returnPct', parseFloat(state.returnPct));
    if (rMsg) state.errors.returnPct = rMsg;
  }
  return Object.keys(state.errors).length === 0;
}

// ---------- shared fragments ----------

function sourceNote() {
  if (state.matchSource === 'ai') return `Matched by ${providerLabel(state.inference)}.`;
  if (state.matchSource === 'sample') return 'Matched to a sample prompt word-for-word.';
  return '';
}

function fieldsHTML(c) {
  return activeInputs(c).map(f => {
    const label = state.supplied.has(f.name) ? `${f.label} · from your text` : f.label;
    return fieldHTML({
      name: f.name, label, unit: displayUnit(c, f),
      value: state.inputs[f.name], error: state.errors[f.name],
    });
  }).join('');
}

function echoHTML() {
  return state.promptEcho ? `<div class="note echo">“${esc(state.promptEcho)}”</div>` : '';
}

function customMetaFields(c) {
  if (!isCustom(c)) return '';
  const unitPrompt = c.impactType === 'fx-bill' ? 'Foreign currency label' : 'Unit label for the quantity';
  return `<div class="field"><label for="f-horizon">Measurement period</label>
      <input id="f-horizon" data-field="horizon" type="text" value="${esc(state.horizon)}"></div>
    <div class="field"><label for="f-unitLabel">${unitPrompt}</label>
      <input id="f-unitLabel" data-field="unitLabel" type="text" value="${esc(state.unitLabel)}"></div>`;
}

// ---------- screens ----------

function renderEntry() {
  const pickBtn = c =>
    `<li><button data-action="pick" data-case="${c.id}">${esc(c.samplePrompt)}</button></li>`;
  const curated = CASES.map(pickBtn).join('');
  const templates = CUSTOM_CASES.map(c =>
    `<li><button data-action="pick" data-case="${c.id}">${esc(c.samplePrompt)}</button></li>`).join('');
  const chips = state.suggestions.map(id => {
    const c = caseById(id);
    return c ? `<button class="chip" data-action="pick" data-case="${c.id}">${esc(c.title)}</button>` : '';
  }).join('');

  let msg = '';
  if (state.entryMessage === 'ambiguous') {
    msg = `<div class="note">Which single expense, income stream, or foreign bill could change? Describe that cash flow and the period you want to test.</div>`;
  } else if (state.entryMessage === 'unsupported') {
    msg = `<div class="note warn">${esc(SCOPE_MESSAGE)}</div>`;
  } else if (state.entryMessage === 'unavailable') {
    msg = `<div class="note warn">Free-text matching is unavailable. Choose a calculator below to enter your assumptions manually.</div>`;
  }

  app.innerHTML = `<section class="entry">
    <h1>If this decision costs you money, how many dollars would a $1,000 investment offset?</h1>
    <textarea id="prompt" maxlength="1200" aria-label="Decision to model" placeholder="What cost, income, or foreign bill could change?">${esc(state.promptText)}</textarea>
    <div class="row"><button class="primary" data-action="analyze" ${state.matching ? 'disabled' : ''}>${state.matching ? 'Matching…' : 'Match this decision'}</button></div>
    ${state.inference.configured ? `<p class="muted small">Free-text matching by ${esc(providerLabel(state.inference))}.</p>` : ''}
    ${msg}
    ${chips ? `<div class="chip-row">${chips}</div>` : ''}
    <p class="muted small">Or start from a supported example</p>
    <ul class="samples">${curated}</ul>
    ${templates ? `<p class="muted small">Or a generic template for your own decision</p><ul class="samples">${templates}</ul>` : ''}
  </section>`;
}

function renderConfirm() {
  const c = caseById(state.caseId);
  const fixed = isFixedUsd(c);
  const custom = isCustom(c);
  let followUp = '';
  if (c.followUp.kind === 'choice') {
    followUp = `<h3>${esc(c.followUp.question)}</h3><div class="choices">` +
      c.followUp.options.map(o =>
        `<button class="choice-btn ${state.followUpChoice === o.id ? 'selected' : ''}" data-action="followup" data-opt="${o.id}">${esc(o.label)}</button>`).join('') +
      `</div>`;
    const chosen = c.followUp.options.find(o => o.id === state.followUpChoice);
    if (chosen && chosen.supported === false) {
      followUp += `<div class="note warn">${esc(c.followUp.unsupportedNote)}</div>`;
    }
  } else {
    followUp = `<h3>${esc(c.followUp.question)}</h3>`;
  }
  const valid = validateAll(c);
  const fields = fieldsHTML(c);
  const chosenUnsupported = c.followUp.kind === 'choice' &&
    c.followUp.options.find(o => o.id === state.followUpChoice && o.supported === false);
  const needsChoice = c.followUp.kind === 'choice' && !state.followUpChoice;
  app.innerHTML = `<section>
    <p class="step">Step 2 of 2 — confirm the exposure</p>
    <h1>${esc(c.title)}</h1>
    ${echoHTML()}
    <p class="muted">We interpreted your decision this way. Correct anything that looks off — every number is editable.</p>
    ${sourceNote() ? `<p class="muted small">${esc(sourceNote())}</p>` : ''}

    ${followUp}
    ${fixed ? `<div class="note key">${esc(c.fixedMode.message)}<br><span class="muted">${esc(c.fixedMode.note)}</span></div>` : ''}
    <div class="field-grid">${customMetaFields(c)}${fields}</div>
    <p class="muted small">${fixed
      ? `Bill of ${fmtUSD(num('fixedBillUsd'))} fixed in US dollars.`
      : custom ? esc(c.riskSummary) : `${esc(c.riskSummary)} Period: ${esc(c.period)}.`}</p>
    <div class="row">
      <button class="primary" data-action="confirm" ${(!valid || needsChoice || chosenUnsupported) ? 'disabled' : ''}>See the hedge</button>
      <button class="ghost" data-action="back">Not my decision</button>
    </div>
  </section>`;
}

function renderResult() {
  const c = caseById(state.caseId);
  const fixed = isFixedUsd(c);
  const custom = isCustom(c);
  const sc = scenarioById(c, state.scenarioId);
  const valid = validateAll(c);

  const impact = valid ? computeImpact(c, sc) : NaN;
  const gain = valid ? computeGain(c, sc) : null;
  const combined = gain === null ? null : combinedChange(impact, gain);
  const classification = Number.isFinite(impact) ? classifyOutcome(impact, gain) : null;
  const label = outcomeText(classification);
  const rDec = valid ? currentReturnDecimal(c, sc) : null;
  const pos = parseFloat(state.position);

  let bar = '';
  if (Number.isFinite(impact) && impact < 0) {
    const loss = Math.abs(impact);
    if (gain === null) {
      bar = `<div class="offset-bar"><div class="loss-part" style="width:100%"></div></div>
        <p class="offset-caption">The position’s outcome is unknown until you supply a return.</p>`;
    } else if (gain > 0) {
      const covered = Math.min(gain, loss);
      bar = `<div class="offset-bar"><div class="covered" style="width:${(covered / loss) * 100}%"></div><div class="loss-part" style="width:${((loss - covered) / loss) * 100}%"></div></div>
        <p class="offset-caption">${fmtUSD(covered)} of the ${fmtUSD(loss)} loss covered — ${(covered / loss * 100).toFixed(0)}%.</p>`;
    } else {
      const total = loss + Math.abs(gain);
      bar = `<div class="offset-bar"><div class="loss-part" style="width:${(loss / total) * 100}%"></div><div class="added" style="width:${(Math.abs(gain) / total) * 100}%"></div></div>
        <p class="offset-caption">${gain === 0 ? 'The position adds nothing — the full loss stands.' : `The position adds ${fmtUSD(Math.abs(gain))} on top of the loss.`}</p>`;
    }
  }

  const scenarioRows = c.scenarios.map(s => {
    const i2 = computeImpact(c, s);
    const g2 = s.id === state.scenarioId ? gain
      : isCashKind(s.kind) ? yenBenchmarkGain(pos || 0, num('budgetRate'), num('scenarioRate'))
      : positionGain(pos || 0, s.returnPct / 100);
    const cb = g2 === null ? null : combinedChange(i2, g2);
    const ret = s.id === state.scenarioId ? fmtPct(rDec) : isCashKind(s.kind)
      ? fmtPct(yenBenchmarkReturnDecimal(num('budgetRate'), num('scenarioRate')))
      : fmtPct(s.returnPct / 100);
    const sub = s.id === state.scenarioId ? '<span class="sc-combined">selected</span>'
      : `<span class="sc-combined">${valid ? fmtSignedUSD(cb) : "—"} combined</span>`;
    return `<button class="scenario ${s.id === state.scenarioId ? 'active' : ''}" data-action="scenario" data-sc="${s.id}">
      <span>${esc(s.label)}${sub}</span><span class="sc-return">${ret}</span></button>`;
  }).join('');

  const fields = fieldsHTML(c);

  const returnField = isCashKind(sc.kind)
    ? `<div class="field"><label>Return over the horizon (from the two rates)</label>
       <input type="text" value="${rDec === null ? '—' : fmtPct(rDec)}" disabled></div>`
    : `<div class="field"><label for="f-returnPct">Assumed ${custom ? 'paper' : 'stock'} return (%)</label>
       <input id="f-returnPct" data-field="returnPct" type="number" step="any" value="${esc(state.returnPct)}" ${state.returnUnknown ? 'disabled' : ''} class="${state.errors.returnPct ? 'invalid' : ''}">
       ${state.errors.returnPct ? `<div class="error">${esc(state.errors.returnPct)}</div>` : ''}</div>`;

  let extras = '';
  if (isCashKind(sc.kind) && rDec !== null && pos > 0) {
    const bought = pos * num('budgetRate');
    const worth = bought / num('scenarioRate');
    const cur = sc.kind === 'yen-cash' ? '¥' : (state.unitLabel || 'units');
    const amount = bought.toLocaleString('en-US', { maximumFractionDigits: 2 });
    extras += `<p class="muted small">At these rates, ${fmtUSD(pos)} buys ${cur === '¥' ? `¥${amount}` : `${amount} ${esc(cur)}`}, worth ${fmtUSD(worth)} when the bill is due.</p>`;
  }
  if (impact < 0 && !state.returnUnknown) {
    const be = breakEvenPosition(impact, rDec);
    extras += be !== null
      ? `<div class="note">At ${fmtPct(rDec)}, covering the whole ${fmtUSD(Math.abs(impact))} loss would take a ${fmtUSD(be)} position. Conditional arithmetic, not a recommendation.</div>`
      : `<div class="note">With a ${rDec === null ? 'unknown' : fmtPct(rDec)} return, no positive holding covers this loss under that assumption.</div>`;
  }
  if (state.returnUnknown && impact < 0) {
    const ber = breakEvenReturn(impact, pos);
    if (ber !== null) extras += `<div class="note">Break-even: your ${fmtUSD(pos)} position would need a ${fmtPct(ber)} return to cover the whole ${fmtUSD(Math.abs(impact))} loss.</div>`;
  }

  let whyPanel;
  if (c.company) {
    const sources = c.company.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('');
    whyPanel = `<section class="panel company">
    <h2>Why ${esc(c.company.name)} (${esc(c.company.ticker)}) appeared</h2>
    <p class="fact"><span class="tag sourced">Sourced fact</span> ${esc(c.company.fact)}</p>
    <p class="caveat">${esc(c.company.caveat)}</p>
    <p class="sources">${sources}</p>
    ${state.inference.configured ? `<div class="ask">
      <input id="ask-q" type="text" maxlength="800" placeholder="Ask about ${esc(c.company.name)} and this risk" value="${esc(state.ask.question)}">
      <button data-action="ask" ${state.ask.loading ? 'disabled' : ''}>${state.ask.loading ? 'Asking…' : 'Ask'}</button>
    </div>
    ${state.ask.answer ? `<p class="ask-answer">${esc(state.ask.answer)}</p>
      <p class="muted small">${esc(providerLabel(state.inference))} selects from the facts and scenarios in this example.</p>` : ''}` : ''}
  </section>`;
  } else {
    const isFx = c.impactType === 'fx-bill';
    const total = num('quantity') * num('baselinePrice');
    const action = c.impactType === 'income' ? 'receiving' : 'paying';
    whyPanel = `<section class="panel company">
    <h2>${isFx ? 'Holding the invoice currency' : 'What if you could fix the price today?'}</h2>
    <p>${isFx
      ? 'Converting dollars at the budgeted rate covers the exchange-rate change on the amount you convert. Select the currency benchmark below to see how much of the bill your paper position covers.'
      : `If you could agree to the baseline rate for the whole quantity, you would model ${action} ${valid ? fmtUSD(total) : 'the baseline total'} over this period. That assumes the agreement covers every unit and carries no fees. You would also give up any benefit from a favorable price move.`}</p>
  </section>`;
  }

  const chosenLabel = c.followUp.kind === 'choice' && state.followUpChoice
    ? c.followUp.options.find(o => o.id === state.followUpChoice)?.label : null;

  app.innerHTML = `
  <section class="verdict">
    <div class="verdict-number ${combined === null ? '' : combined < 0 ? 'neg' : 'pos'}">${combined === null ? '—' : fmtSignedUSD(roundCents(combined))}</div>
    <div class="verdict-parts">decision ${fmtSignedUSD(roundCents(impact))}, hedge ${fmtSignedUSD(gain)}${combined === null ? ' — combined unknown' : ''}</div>
    ${bar}
    <p class="verdict-label">${valid ? esc(label.text) : 'Correct the highlighted inputs to recalculate.'}</p>
    ${extras}
  </section>

  ${whyPanel}

  <section class="split">
    <div class="col">
      <h2>Your decision</h2>
      <p class="muted small">${esc(c.title)}${chosenLabel ? ` — ${esc(chosenLabel)}` : ''}. ${esc(periodText(c))}.</p>
      ${echoHTML()}
      ${fixed ? `<div class="note key">${esc(c.fixedMode.message)}<br><span class="muted">${esc(c.fixedMode.note)}</span></div>` : ''}
      <div class="field-grid">${fields}</div>
      <p class="impact-line small">Decision impact: <strong class="${impact < 0 ? 'neg' : ''}">${fmtSignedUSD(roundCents(impact))}</strong></p>
      <button class="ghost" data-action="back">Change decision</button>
    </div>
    <div class="col">
      <h2>The paper hedge <span class="tag synthetic">Synthetic outcomes</span></h2>
      <div class="scenario-list">${scenarioRows}</div>
      <p class="scenario-reason">${esc(sc.reason)}</p>
      <div class="field-grid">
        <div class="field"><label for="f-position">Paper position (USD)</label>
          <input id="f-position" data-field="position" type="number" step="any" value="${esc(state.position)}" class="${state.errors.position ? 'invalid' : ''}">
          ${state.errors.position ? `<div class="error">${esc(state.errors.position)}</div>` : ''}</div>
        ${returnField}
        ${!isCashKind(sc.kind) ? `<div class="field"><div class="checkbox-row"><input id="f-unknown" data-field="returnUnknown" type="checkbox" ${state.returnUnknown ? 'checked' : ''}><label for="f-unknown">I don’t know the return</label></div></div>` : ''}
      </div>
      <button data-action="fail">What would make this fail?</button>
      ${state.showFailure ? `<div class="note warn">${esc(c.company ? c.company.caveat : 'This is the failure path: under the same hit to you, the paper position loses too. No outcome here is guaranteed.')}</div>` : ''}
    </div>
  </section>

  <p class="fineprint">Held as cash instead, ${fmtUSD(pos || 0)} earns $0 by assumption — a $0 position leaves the decision’s ${fmtSignedUSD(roundCents(impact))} untouched.</p>`;
}

function render() {
  if (state.screen === 'entry') renderEntry();
  else if (state.screen === 'confirm') renderConfirm();
  else renderResult();
  document.getElementById('assumptions').innerHTML =
    `<strong>How this demo treats uncertainty:</strong><ul>${ASSUMPTIONS.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
}

// ---------- events ----------

function applyAiInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') return;
  for (const [k, v] of Object.entries(inputs)) {
    if (!Number.isFinite(v)) continue;
    if (k === 'position') { state.position = String(v); state.supplied.add(k); }
    else if (k in state.inputs) { state.inputs[k] = String(v); state.supplied.add(k); }
  }
}

app.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const c = state.caseId ? caseById(state.caseId) : null;
  switch (btn.dataset.action) {
    case 'pick':
      state.matchSeq++;
      initCase(btn.dataset.case);
      break;
    case 'analyze': {
      state.promptText = document.getElementById('prompt').value;
      const text = state.promptText.trim();
      state.matching = true;
      state.entryMessage = null;
      state.suggestions = [];
      const seq = ++state.matchSeq;
      render();
      // Stale-guard: drop the response if a newer request started, the user
      // left the entry screen, or the text was edited while the call flew.
      const fresh = () => seq === state.matchSeq && state.screen === 'entry' &&
        (document.getElementById('prompt')?.value ?? text).trim() === text;
      try {
        // Exact sample wording matches locally — works with or without the inference service.
        const exact = matchSample(text);
        if (exact) {
          initCase(exact.caseId);
          state.matchSource = 'sample';
          state.promptEcho = text;
        } else if (!text) {
          state.entryMessage = 'unsupported';
        } else {
          // Await the status probe so we never fire a pointless request.
          const status = await inferenceStatus();
          const res = fresh() && status.configured ? await interpretDecision(text) : null;
          if (fresh()) {
            if (res && res.type === 'match' && caseById(res.caseId)) {
              initCase(res.caseId);
              state.matchSource = 'ai';
              state.promptEcho = text;
              applyAiInputs(res.inputs);
            } else if (res && (res.type === 'ambiguous' || res.type === 'unsupported')) {
              state.entryMessage = res.type;
              state.suggestions = res.type === 'ambiguous' ? suggestCases(text) : [];
            } else {
              // Offline, timed out, or the model answered outside the contract.
              state.entryMessage = 'unavailable';
              state.suggestions = suggestCases(text);
            }
          }
        }
      } finally {
        if (seq === state.matchSeq) {
          state.matching = false;
          const el = document.getElementById('prompt');
          if (state.screen === 'entry' && el) state.promptText = el.value;
        }
      }
      break;
    }
    case 'ask': {
      const q = document.getElementById('ask-q').value.trim();
      if (!q || state.ask.loading || !c || !c.company) break;
      state.ask = { question: q, answer: null, loading: true };
      render();
      const answer = await askAbout({ caseId: c.id }, q);
      // Drop stale answers if the user navigated away or asked again meanwhile.
      if (state.caseId === c.id && state.screen === 'result' && state.ask.question === q) {
        state.ask = { question: q, answer: answer || `${providerLabel(state.inference)} could not answer — check the connection and try again.`, loading: false };
      }
      break;
    }
    case 'followup': {
      state.followUpChoice = btn.dataset.opt;
      const opt = c.followUp.options.find(o => o.id === state.followUpChoice);
      if (c.id === 'yen' && opt && opt.id === 'usd-invoice') {
        for (const f of c.fixedMode.inputs) if (!(f.name in state.inputs)) state.inputs[f.name] = String(f.default);
      }
      break;
    }
    case 'confirm': if (validateAll(c)) state.screen = 'result'; break;
    case 'back': state.screen = 'entry'; state.entryMessage = null; state.suggestions = []; break;
    case 'scenario': {
      state.scenarioId = btn.dataset.sc;
      const s = scenarioById(c, state.scenarioId);
      state.returnPct = isCashKind(s.kind) ? '' : String(s.returnPct);
      state.returnUnknown = false;
      state.showFailure = false;
      break;
    }
    case 'fail': {
      const f = c.scenarios.find(s => s.isFailure);
      if (f) {
        state.scenarioId = f.id;
        if (!isCashKind(f.kind)) { state.returnPct = String(f.returnPct); state.returnUnknown = false; }
        state.showFailure = true;
      }
      break;
    }
  }
  render();
});

app.addEventListener('change', e => {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const name = el.dataset.field;
  state.supplied.delete(name);
  if (name === 'position') state.position = el.value;
  else if (name === 'returnPct') state.returnPct = el.value;
  else if (name === 'returnUnknown') state.returnUnknown = el.checked;
  else if (name === 'horizon') state.horizon = el.value;
  else if (name === 'unitLabel') state.unitLabel = el.value;
  else state.inputs[name] = el.value;
  render();
});

app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'prompt' && (e.metaKey || e.ctrlKey)) {
    document.querySelector('[data-action="analyze"]').click();
  }
});

inferenceStatus().then(s => {
  state.inference = s;
  const el = document.getElementById('prompt');
  if (state.screen === 'entry' && el) state.promptText = el.value;
  render();
});
render();
