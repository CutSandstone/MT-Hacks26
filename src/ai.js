let statusPromise = null;

const PROVIDER_NAMES = { devin: 'Devin Gateway', snowflake: 'Snowflake Cortex' };

// GET /api/status -> {provider:'devin'|'snowflake', configured:bool, model:str}.
// The legacy shape {snowflake:bool, model:str} implies provider 'snowflake'.
export function inferenceStatus() {
  statusPromise ??= Promise.resolve()
    .then(() => fetch('/api/status'))
    .then(r => (r.ok ? r.json() : {}))
    .then(s => {
      const o = s && typeof s === 'object' ? s : {};
      const known = o.provider === 'devin' || o.provider === 'snowflake';
      return {
        provider: known ? o.provider : 'snowflake' in o ? 'snowflake' : 'devin',
        configured: known ? !!o.configured : !!o.snowflake,
        model: typeof o.model === 'string' ? o.model : '',
      };
    })
    .catch(() => ({ provider: 'devin', configured: false, model: '' }));
  return statusPromise;
}

// e.g. "Devin Gateway (swe-2-high)" or "Snowflake Cortex (mistral-large3)".
export function providerLabel(status) {
  const name = PROVIDER_NAMES[status && status.provider] || PROVIDER_NAMES.devin;
  const model = status && typeof status.model === 'string' ? status.model : '';
  return model ? `${name} (${model})` : name;
}

async function post(path, body, timeoutMs = 70000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const cleanInputs = obj => {
  if (!obj || typeof obj !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

// /api/interpret contract: {type:'match',caseId,inputs?} | {type:'ambiguous'} | {type:'unsupported'}.
// Anything else — network failure, non-200, unparseable body — is reported as
// {type:'unavailable'} so the UI can show an explicit offline state instead of
// silently guessing.
export async function interpretDecision(text) {
  const res = await post('/api/interpret', { text });
  if (!res || typeof res !== 'object') return { type: 'unavailable' };
  if (res.type === 'match' && typeof res.caseId === 'string') {
    return { type: 'match', caseId: res.caseId, inputs: cleanInputs(res.inputs) };
  }
  if (res.type === 'ambiguous' || res.type === 'unsupported') return { type: res.type };
  return { type: 'unavailable' };
}

export async function askAbout(context, question) {
  const res = await post('/api/ask', { context, question });
  return res && typeof res.answer === 'string' ? res.answer : null;
}
