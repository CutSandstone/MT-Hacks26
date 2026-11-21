import { CASES, CUSTOM_CASES } from './fixtures.js';

const ALL_CASES = [...CASES, ...CUSTOM_CASES];

const keywordRe = k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Exact sample-prompt match (case/punctuation-insensitive). This is the only
// local path that may select a case on its own — works offline and never
// guesses beyond the curated/sample wording.
export function matchSample(text) {
  const n = norm(text);
  if (!n) return null;
  const hit = ALL_CASES.find(c => typeof c.samplePrompt === 'string' && norm(c.samplePrompt) === n);
  return hit ? { type: 'match', caseId: hit.id } : null;
}

// Legacy keyword matching, repurposed for suggestions only: returns up to
// `limit` candidate case ids for the user to confirm manually. It never
// returns a bare match — the caller decides what to show.
export function suggestCases(text, limit = 3) {
  const lower = norm(text);
  if (!lower) return [];
  return ALL_CASES
    .filter(c => Array.isArray(c.keywords) && c.keywords.some(k => keywordRe(k).test(lower)))
    .slice(0, limit)
    .map(c => c.id);
}
