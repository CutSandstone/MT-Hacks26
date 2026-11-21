import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSample, suggestCases } from '../src/matcher.js';
import * as fixtures from '../src/fixtures.js';

const CASES = fixtures.CASES || [];
const CUSTOM_CASES = fixtures.CUSTOM_CASES || [];
const ALL = [...CASES, ...CUSTOM_CASES];

test('each samplePrompt matches its own case exactly', () => {
  for (const c of ALL) {
    assert.deepEqual(matchSample(c.samplePrompt), { type: 'match', caseId: c.id });
  }
});

test('sample matching ignores case and punctuation', () => {
  const c = ALL[0];
  const noisy = `  ${c.samplePrompt.toUpperCase()}!!!  `;
  assert.deepEqual(matchSample(noisy), { type: 'match', caseId: c.id });
});

test('paraphrased prompts do NOT auto-match locally', () => {
  // Keyword-overlapping but not the sample wording — must not bypass confirmation.
  assert.equal(matchSample('cybersecurity worries me a lot'), null);
  assert.equal(matchSample("I'm buying a car for my commute in Japan"), null);
  assert.equal(matchSample('Should I buy Bitcoin to hedge inflation?'), null);
});

test('empty and whitespace input produce no match or suggestions', () => {
  assert.equal(matchSample(''), null);
  assert.equal(matchSample('   '), null);
  assert.deepEqual(suggestCases(''), []);
  assert.deepEqual(suggestCases('   '), []);
});

test('suggestCases offers keyword candidates without deciding', () => {
  const ids = suggestCases('gas car commute fuel prices');
  assert.ok(ids.includes('car'));
  assert.ok(!ids.includes('cyber'));
  assert.ok(ids.length <= 3);
});

test('suggestCases returns multiple candidates for cross-case prompts', () => {
  const ids = suggestCases("I'm buying a car for my commute in Japan");
  assert.ok(ids.includes('car'));
  assert.ok(ids.includes('yen'));
});

test('suggestCases covers custom templates too', () => {
  for (const c of CUSTOM_CASES) {
    if (!Array.isArray(c.keywords) || !c.keywords.length) continue;
    assert.ok(suggestCases(c.samplePrompt, ALL.length).includes(c.id),
      `expected suggestion for custom template ${c.id}`);
  }
});

test('unrelated prompts get no suggestions', () => {
  assert.deepEqual(suggestCases('What pizza should I order tonight?'), []);
});
