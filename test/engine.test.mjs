// Tests for src/engine.js — run with `node --test test/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundCents, careerImpact, commutingImpact, tuitionImpactYen, tuitionImpactFixedDollar,
  unitCashImpact, foreignBillImpact,
  positionGain, yenBenchmarkReturnDecimal, yenBenchmarkGain, combinedChange, coverageShare,
  breakEvenPosition, breakEvenReturn, classifyOutcome, validateField, OUTCOME,
} from '../src/engine.js';

const approx = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.005, `expected ${actual} ≈ ${expected}`);

test('roundCents rounds to 2 decimals sanely', () => {
  assert.equal(roundCents(200.005), 200.01);
  assert.equal(roundCents(1.234), 1.23);
  assert.equal(roundCents(-3.456), -3.46);
  assert.equal(roundCents(0), 0);
});

test('cybersecurity case: career impact offset by stock position', () => {
  const impact = careerImpact(2, 1500);
  approx(impact, -3000);

  const gainUp = positionGain(1000, 0.20);
  approx(gainUp, 200);
  approx(combinedChange(impact, gainUp), -2800);

  const gainDown = positionGain(1000, -0.20);
  approx(gainDown, -200);
  approx(combinedChange(impact, gainDown), -3200);

  const zeroImpact = careerImpact(0, 1500);
  approx(zeroImpact, 0);
  const gainFlat = positionGain(1000, 0.10);
  approx(gainFlat, 100);
  approx(combinedChange(zeroImpact, gainFlat), 100);
});

test('commuting case: gas price increase vs stock position', () => {
  const impact = commutingImpact(12000, 30, 3.50, 4.50);
  approx(impact, -400);

  const gain = positionGain(1000, 0.15);
  approx(gain, 150);
  approx(combinedChange(impact, gain), -250);

  const gainZero = positionGain(1000, 0);
  approx(gainZero, 0);
  approx(combinedChange(impact, gainZero), -400);

  approx(commutingImpact(12000, 40, 3.50, 4.50), -300);
});

test('tuition case: stronger yen, stock and yen benchmark offsets', () => {
  const impact = tuitionImpactYen(600000, 150, 125);
  approx(impact, -800);

  const loss = positionGain(1000, -0.10);
  approx(loss, -100);
  approx(combinedChange(impact, loss), -900);

  const gain = positionGain(1000, 0.08);
  approx(gain, 80);
  approx(combinedChange(impact, gain), -720);

  approx(yenBenchmarkReturnDecimal(150, 125), 0.20);
  const bench = yenBenchmarkGain(1000, 150, 125);
  approx(bench, 200);
  approx(combinedChange(impact, bench), -600);

  assert.equal(tuitionImpactFixedDollar(), 0);
});

test('editable position flows through to combined change', () => {
  const gain = positionGain(500, 0.20);
  approx(gain, 100);
  approx(combinedChange(-3000, gain), -2900);
});

test('breakEvenPosition returns hypothetical covering position', () => {
  approx(breakEvenPosition(-3000, 0.20), 15000);
  assert.equal(breakEvenPosition(-3000, 0), null);
  assert.equal(breakEvenPosition(-3000, -0.2), null);
  assert.equal(breakEvenPosition(0, 0.2), null);
});

test('breakEvenReturn returns required return for entered position', () => {
  approx(breakEvenReturn(-400, 1000), 0.40);
  assert.equal(breakEvenReturn(-400, 0), null);
  assert.equal(breakEvenReturn(0, 1000), null);
});

test('unknown return propagates as null', () => {
  assert.equal(positionGain(1000, null), null);
  assert.equal(positionGain(1000, undefined), null);
  assert.equal(positionGain(1000, NaN), null);
  assert.equal(combinedChange(-400, null), null);
  assert.equal(classifyOutcome(-400, null), null);
});

test('classifyOutcome covers all five outcomes', () => {
  assert.equal(classifyOutcome(0, 100), OUTCOME.NO_LOSS);
  assert.equal(classifyOutcome(-3000, 200), OUTCOME.PARTIAL);
  assert.equal(classifyOutcome(-3000, 3500), OUTCOME.FULL);
  assert.equal(classifyOutcome(-3000, 3000), OUTCOME.FULL);
  assert.equal(classifyOutcome(-400, 0), OUTCOME.NO_EFFECT);
  assert.equal(classifyOutcome(-3000, -200), OUTCOME.INCREASES);
});

test('coverageShare reports fraction of loss covered', () => {
  approx(coverageShare(-3000, 200), 0.0667);
  approx(coverageShare(-3000, 3000), 1);
  assert.equal(coverageShare(-3000, -200), null);
  assert.equal(coverageShare(-3000, 0), null);
  assert.equal(coverageShare(0, 100), null);
  assert.equal(coverageShare(-3000, null), null);
});

test('validateField returns field-specific errors or null', () => {
  assert.equal(validateField('position', -5), 'Position size cannot be negative.');
  assert.equal(validateField('position', 0), null);
  assert.equal(validateField('position', 1000), null);
  assert.equal(validateField('returnPct', -150), 'Assumed return cannot be below −100%.');
  assert.equal(validateField('returnPct', -100), null);
  assert.equal(validateField('mpg', 0), 'Fuel economy must be greater than 0 mpg.');
  assert.equal(validateField('mpg', 30), null);
  assert.equal(validateField('budgetRate', 0), 'Exchange rate must be greater than 0 foreign units per dollar.');
  assert.equal(validateField('scenarioRate', -5), 'Exchange rate must be greater than 0 foreign units per dollar.');
  assert.equal(validateField('extraMonths', -1), 'Extra months cannot be negative.');
  assert.equal(validateField('extraMonths', 0), null);
  assert.equal(validateField('nonexistentField', -999), null);
  assert.match(validateField('position', NaN), /must be a number/);
  assert.match(validateField('mpg', null), /must be a number/);
});

test('validateField rejects nonfinite values', () => {
  assert.match(validateField('position', Infinity), /must be a number/);
  assert.match(validateField('position', -Infinity), /must be a number/);
  assert.match(validateField('returnPct', Infinity), /must be a number/);
  assert.match(validateField('budgetRate', Infinity), /must be a number/);
  assert.match(validateField('quantity', Infinity), /must be a number/);
});

test('validateField covers the custom scenario fields', () => {
  assert.equal(validateField('quantity', 0), 'Quantity must be greater than 0.');
  assert.equal(validateField('quantity', -2), 'Quantity must be greater than 0.');
  assert.equal(validateField('quantity', 1), null);
  assert.equal(validateField('baselinePrice', -1), 'Baseline price cannot be negative.');
  assert.equal(validateField('baselinePrice', 0), null);
  assert.equal(validateField('stressPrice', -0.5), 'Stress price cannot be negative.');
  assert.equal(validateField('stressPrice', 4.5), null);
  assert.equal(validateField('foreignDue', -100), 'Foreign amount due cannot be negative.');
  assert.equal(validateField('foreignDue', 0), null);
  assert.match(validateField('quantity', NaN), /must be a number/);
});

test('unitCashImpact signs: expenses lose when price rises, incomes when it falls', () => {
  // expense: stress above baseline is a loss
  approx(unitCashImpact(400, 3.50, 4.50, false), -400);
  // expense: stress below baseline is a saving
  approx(unitCashImpact(400, 3.50, 3.00, false), 200);
  // income: stress below baseline is a loss
  approx(unitCashImpact(400, 3.50, 3.00, true), -200);
  // income: stress above baseline is a gain
  approx(unitCashImpact(400, 3.50, 4.50, true), 400);
  // quantity 1 works for lump totals
  approx(unitCashImpact(1, 5000, 6000, false), -1000);
  approx(unitCashImpact(1, 5000, 4000, true), -1000);
  // no price change means no impact either way
  approx(unitCashImpact(400, 3.50, 3.50, false), 0);
  approx(unitCashImpact(400, 3.50, 3.50, true), 0);
});

test('foreignBillImpact matches the yen-bill arithmetic for any currency', () => {
  // foreign currency strengthens (fewer units per USD): the bill costs more
  approx(foreignBillImpact(600000, 150, 125), -800);
  // same arithmetic as the yen tuition helper
  approx(foreignBillImpact(600000, 150, 125), tuitionImpactYen(600000, 150, 125));
  // foreign currency weakens (more units per USD): the bill costs less
  approx(foreignBillImpact(600000, 150, 200), 1000);
  // unchanged rate means no impact
  approx(foreignBillImpact(600000, 150, 150), 0);
  // works for currencies quoted under 1 unit per USD (e.g. EUR-like rates);
  // here the rate rises, the currency weakens, and the bill gets cheaper
  approx(foreignBillImpact(1000, 0.8, 1), 250);
});

test('foreign-cash benchmark reuses the yen benchmark math', () => {
  // hold foreign cash: position bought at budget rate is worth more when the
  // foreign currency strengthens — identical math to holding yen.
  const r = yenBenchmarkReturnDecimal(150, 125);
  approx(r, 0.20);
  approx(yenBenchmarkGain(1000, 150, 125), 200);
  const impact = foreignBillImpact(600000, 150, 125);
  approx(combinedChange(impact, yenBenchmarkGain(1000, 150, 125)), -600);
});

test('zero position is allowed and yields NO_EFFECT against a loss', () => {
  const gain = positionGain(0, 0.2);
  assert.equal(gain, 0);
  assert.equal(classifyOutcome(-3000, gain), OUTCOME.NO_EFFECT);
});

test('OUTCOME constants are frozen', () => {
  assert.ok(Object.isFrozen(OUTCOME));
  assert.equal(OUTCOME.NO_LOSS, 'no-loss');
  assert.equal(OUTCOME.PARTIAL, 'partial');
  assert.equal(OUTCOME.FULL, 'full');
  assert.equal(OUTCOME.NO_EFFECT, 'no-effect');
  assert.equal(OUTCOME.INCREASES, 'increases');
});
