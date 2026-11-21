import { OUTCOME } from './engine.js';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function fmtUSD(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return usd.format(n);
}

export function fmtSignedUSD(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return 'unknown';
  const abs = usd.format(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `−${abs}` : abs;
}

export function fmtPct(d) {
  if (d === null || d === undefined || Number.isNaN(d)) return 'unknown';
  const pct = Math.abs(d * 100);
  const s = `${pct % 1 ? pct.toFixed(1) : pct}%`;
  return d > 0 ? `+${s}` : d < 0 ? `−${s}` : s;
}

export function outcomeText(classification) {
  switch (classification) {
    case OUTCOME.NO_LOSS: return { text: 'No loss to offset', cls: 'pos' };
    case OUTCOME.PARTIAL: return { text: 'Partially offsets the loss', cls: '' };
    case OUTCOME.FULL: return { text: 'Fully covers the loss', cls: 'pos' };
    case OUTCOME.NO_EFFECT: return { text: 'No effect', cls: '' };
    case OUTCOME.INCREASES: return { text: 'Increases the loss', cls: 'neg' };
    default: return { text: 'Combined result unknown until a return is supplied', cls: '' };
  }
}

export function fieldHTML({ name, label, unit, value, error }) {
  return `<div class="field">
    <label for="f-${esc(name)}">${esc(label)}${unit ? ` <span class="unit">(${esc(unit)})</span>` : ''}</label>
    <input id="f-${esc(name)}" data-field="${esc(name)}" type="number" step="any" inputmode="decimal" value="${esc(value)}" class="${error ? 'invalid' : ''}"${error ? ` aria-invalid="true" aria-describedby="error-${esc(name)}"` : ''}>
    ${error ? `<div class="error" id="error-${esc(name)}">${esc(error)}</div>` : ''}
  </div>`;
}
