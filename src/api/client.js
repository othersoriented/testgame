// Minimal API client that only activates if env + token exist.
import { init as initAuth, enabled as authEnabled, accessToken, rawConfig } from '../auth/client.js';

let _base = null;
let _ready = false;

async function ensure() {
  if (!_ready) {
    await initAuth();
    const cfg = rawConfig();
    _base = cfg?.apiBaseUrl || null;
    _ready = true;
  }
}

async function authedHeaders() {
  const t = await accessToken();
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function get(path) {
  await ensure();
  if (!_base || !authEnabled()) throw new Error('API not configured');
  const r = await fetch(_base + path, { headers: await authedHeaders(), credentials: 'omit' });
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return r.json();
}

export async function post(path, body) {
  await ensure();
  if (!_base || !authEnabled()) throw new Error('API not configured');
  const r = await fetch(_base + path, { method: 'POST', headers: await authedHeaders(), body: JSON.stringify(body || {}), credentials: 'omit' });
  if (!r.ok) throw new Error(`POST ${path} ${r.status}`);
  return r.json();
}

// Safe helper: try submit a run; no-ops on missing config
export async function maybeSubmitRun(payload) {
  try { await post('/api/run', payload); } catch { /* ignore when not configured */ }
}

