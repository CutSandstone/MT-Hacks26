// Tests for src/ai.js — the /api/status + /api/interpret + /api/ask client contract.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { interpretDecision, askAbout } from '../src/ai.js';

// statusPromise is memoized module state; a query-string import gives each
// status test a fresh module instance.
const freshAi = tag => import(`../src/ai.js?${tag}`);

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const okJson = obj => async () => ({ ok: true, json: async () => obj });
const httpError = code => async () => ({ ok: false, status: code, json: async () => ({}) });
const networkDown = async () => { throw new TypeError('fetch failed'); };

test('interpretDecision passes through a valid match with sanitized inputs', async () => {
  globalThis.fetch = okJson({
    type: 'match', caseId: 'car',
    inputs: { mpg: 40, annualMiles: 9000, junk: 'nope', bad: NaN, negInf: -Infinity },
  });
  const res = await interpretDecision('buying a gas car, 40 mpg, 9000 miles');
  assert.equal(res.type, 'match');
  assert.equal(res.caseId, 'car');
  assert.deepEqual(res.inputs, { mpg: 40, annualMiles: 9000 });
});

test('interpretDecision handles match with no usable inputs', async () => {
  globalThis.fetch = okJson({ type: 'match', caseId: 'fx-bill', inputs: { q: 'abc' } });
  const res = await interpretDecision('a bill in euros');
  assert.deepEqual(res, { type: 'match', caseId: 'fx-bill', inputs: undefined });
});

test('interpretDecision passes through ambiguous and unsupported', async () => {
  globalThis.fetch = okJson({ type: 'ambiguous' });
  assert.deepEqual(await interpretDecision('moving for school'), { type: 'ambiguous' });
  globalThis.fetch = okJson({ type: 'unsupported' });
  assert.deepEqual(await interpretDecision('hedge my crypto'), { type: 'unsupported' });
});

test('interpretDecision reports unavailable on http errors and network failure', async () => {
  globalThis.fetch = httpError(503);
  assert.deepEqual(await interpretDecision('anything'), { type: 'unavailable' });
  globalThis.fetch = networkDown;
  assert.deepEqual(await interpretDecision('anything'), { type: 'unavailable' });
});

test('interpretDecision reports unavailable on off-contract payloads', async () => {
  for (const body of [
    { type: 'match' },                          // missing caseId
    { type: 'match', caseId: 42 },              // wrong type
    { type: 'maybe' },                          // unknown type
    'a string',
    null,
  ]) {
    globalThis.fetch = okJson(body);
    assert.deepEqual(await interpretDecision('x'), { type: 'unavailable' }, JSON.stringify(body));
  }
});

test('interpretDecision does not reject unknown caseIds — app layer validates', async () => {
  globalThis.fetch = okJson({ type: 'match', caseId: 'not-a-real-case' });
  const res = await interpretDecision('x');
  assert.equal(res.type, 'match');
  assert.equal(res.caseId, 'not-a-real-case');
});

test('askAbout returns the answer string or null on failure', async () => {
  globalThis.fetch = okJson({ answer: 'Because the filing says so.' });
  assert.equal(await askAbout({ title: 't' }, 'why?'), 'Because the filing says so.');
  globalThis.fetch = okJson({ answer: 123 });
  assert.equal(await askAbout({}, 'why?'), null);
  globalThis.fetch = networkDown;
  assert.equal(await askAbout({}, 'why?'), null);
});

test('inferenceStatus normalizes the Devin Gateway payload', async () => {
  const { inferenceStatus, providerLabel } = await freshAi('devin');
  globalThis.fetch = okJson({ provider: 'devin', configured: true, model: 'swe-2-high', snowflake: false });
  const s = await inferenceStatus();
  assert.deepEqual(s, { provider: 'devin', configured: true, model: 'swe-2-high' });
  assert.equal(providerLabel(s), 'Devin Gateway (swe-2-high)');
});

test('inferenceStatus normalizes the Snowflake payload', async () => {
  const { inferenceStatus, providerLabel } = await freshAi('snowflake');
  globalThis.fetch = okJson({ provider: 'snowflake', configured: true, model: 'mistral-large3', snowflake: true });
  const s = await inferenceStatus();
  assert.deepEqual(s, { provider: 'snowflake', configured: true, model: 'mistral-large3' });
  assert.equal(providerLabel(s), 'Snowflake Cortex (mistral-large3)');
});

test('inferenceStatus reads the legacy {snowflake, model} payload as Snowflake', async () => {
  const { inferenceStatus } = await freshAi('legacy');
  globalThis.fetch = okJson({ snowflake: true, model: 'm' });
  assert.deepEqual(await inferenceStatus(), { provider: 'snowflake', configured: true, model: 'm' });
});

test('inferenceStatus reports unconfigured when the probe fails or errors', async () => {
  const { inferenceStatus } = await freshAi('down');
  globalThis.fetch = networkDown;
  assert.deepEqual(await inferenceStatus(), { provider: 'devin', configured: false, model: '' });
  const { inferenceStatus: status503 } = await freshAi('err');
  globalThis.fetch = httpError(503);
  assert.equal((await status503()).configured, false);
});

test('inferenceStatus memoizes — a second call must not re-fetch', async () => {
  const { inferenceStatus } = await freshAi('memo');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ provider: 'devin', configured: true, model: 'm' }) }; };
  const a = await inferenceStatus();
  const b = await inferenceStatus();
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
});

test('providerLabel omits the parenthetical when no model is reported', async () => {
  const { providerLabel } = await freshAi('label');
  assert.equal(providerLabel({ provider: 'devin', configured: false, model: '' }), 'Devin Gateway');
  assert.equal(providerLabel({ provider: 'snowflake', configured: true }), 'Snowflake Cortex');
});
