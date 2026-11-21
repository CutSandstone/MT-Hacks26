// Pure calculation engine — no DOM, no I/O, no imports.
// Sign convention: positive = user keeps/gains money; negative = loss.
// Exchange rates are foreign units per USD (lower rate = stronger foreign currency).

export function roundCents(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function careerImpact(extraMonths, monthlyEarningsDiff) {
  return -(extraMonths * monthlyEarningsDiff);
}

export function commutingImpact(annualMiles, mpg, budgetPricePerGallon, scenarioPricePerGallon) {
  return -(annualMiles / mpg) * (scenarioPricePerGallon - budgetPricePerGallon);
}

export function tuitionImpactYen(yenDue, budgetRate, scenarioRate) {
  return foreignBillImpact(yenDue, budgetRate, scenarioRate);
}

export function tuitionImpactFixedDollar() {
  return 0;
}

// Custom scenarios: an expense loses money when the unit price rises above baseline;
// an income loses money when the unit price received falls below baseline.
export function unitCashImpact(quantity, baselinePrice, stressPrice, isIncome) {
  const change = quantity * (stressPrice - baselinePrice);
  return isIncome ? change : -change;
}

// Rates are foreign units per USD (lower rate = stronger foreign currency).
export function foreignBillImpact(foreignDue, budgetRate, scenarioRate) {
  return foreignDue / budgetRate - foreignDue / scenarioRate;
}

export function positionGain(position, returnDecimal) {
  if (returnDecimal == null || Number.isNaN(returnDecimal)) return null;
  return position * returnDecimal;
}

export function yenBenchmarkReturnDecimal(budgetRate, scenarioRate) {
  return budgetRate / scenarioRate - 1;
}

export function yenBenchmarkGain(position, budgetRate, scenarioRate) {
  return position * yenBenchmarkReturnDecimal(budgetRate, scenarioRate);
}

export function combinedChange(decisionImpact, gain) {
  if (gain === null) return null;
  return decisionImpact + gain;
}

export function coverageShare(decisionImpact, gain) {
  if (decisionImpact < 0 && typeof gain === 'number' && !Number.isNaN(gain) && gain > 0) {
    return gain / Math.abs(decisionImpact);
  }
  return null;
}

export function breakEvenPosition(decisionImpact, returnDecimal) {
  if (decisionImpact < 0 && returnDecimal > 0) {
    return Math.abs(decisionImpact) / returnDecimal;
  }
  return null;
}

export function breakEvenReturn(decisionImpact, position) {
  if (decisionImpact < 0 && position > 0) {
    return Math.abs(decisionImpact) / position;
  }
  return null;
}

export const OUTCOME = Object.freeze({
  NO_LOSS: 'no-loss',
  PARTIAL: 'partial',
  FULL: 'full',
  NO_EFFECT: 'no-effect',
  INCREASES: 'increases',
});

export function classifyOutcome(decisionImpact, gain) {
  if (gain === null) return null;
  if (decisionImpact >= 0) return OUTCOME.NO_LOSS;
  if (gain < 0) return OUTCOME.INCREASES;
  if (gain === 0) return OUTCOME.NO_EFFECT;
  if (gain >= Math.abs(decisionImpact)) return OUTCOME.FULL;
  return OUTCOME.PARTIAL;
}

const FIELD_RULES = {
  position:            { label: 'Position size',               test: v => v >= 0,    msg: 'Position size cannot be negative.' },
  returnPct:           { label: 'Assumed return',              test: v => v >= -100, msg: 'Assumed return cannot be below −100%.' },
  mpg:                 { label: 'Fuel economy',                test: v => v > 0,     msg: 'Fuel economy must be greater than 0 mpg.' },
  budgetRate:          { label: 'Exchange rate',               test: v => v > 0,     msg: 'Exchange rate must be greater than 0 foreign units per dollar.' },
  scenarioRate:        { label: 'Exchange rate',               test: v => v > 0,     msg: 'Exchange rate must be greater than 0 foreign units per dollar.' },
  annualMiles:         { label: 'Annual miles',                test: v => v >= 0,    msg: 'Annual miles cannot be negative.' },
  extraMonths:         { label: 'Extra months',                test: v => v >= 0,    msg: 'Extra months cannot be negative.' },
  monthlyEarningsDiff: { label: 'Monthly earnings difference', test: v => v >= 0,    msg: 'Monthly earnings difference cannot be negative.' },
  budgetPrice:         { label: 'Budget fuel price',           test: v => v >= 0,    msg: 'Budget fuel price cannot be negative.' },
  scenarioPrice:       { label: 'Scenario fuel price',         test: v => v >= 0,    msg: 'Scenario fuel price cannot be negative.' },
  yenDue:              { label: 'Yen amount due',              test: v => v >= 0,    msg: 'Yen amount due cannot be negative.' },
  fixedBillUsd:        { label: 'Fixed bill amount',           test: v => v >= 0,    msg: 'Fixed bill amount cannot be negative.' },
  quantity:            { label: 'Quantity',                    test: v => v > 0,     msg: 'Quantity must be greater than 0.' },
  baselinePrice:       { label: 'Baseline price',              test: v => v >= 0,    msg: 'Baseline price cannot be negative.' },
  stressPrice:         { label: 'Stress price',                test: v => v >= 0,    msg: 'Stress price cannot be negative.' },
  foreignDue:          { label: 'Foreign amount due',          test: v => v >= 0,    msg: 'Foreign amount due cannot be negative.' },
};

export function validateField(name, value) {
  const rule = FIELD_RULES[name];
  if (!rule) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${rule.label} must be a number.`;
  return rule.test(value) ? null : rule.msg;
}
