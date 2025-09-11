// Lightweight, non-breaking auth shim. Activates only if /content/env.json exists
// and the AWS Amplify script can be loaded from CDN. Otherwise, it no-ops.

const ENV_URL = '/content/env.json';
let Amplify = null;
let Auth = null;
let _enabled = false;
let _cfg = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function fetchEnv() {
  try {
    const r = await fetch(ENV_URL, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function init() {
  _cfg = await fetchEnv();
  if (!_cfg || !_cfg.userPoolId || !_cfg.userPoolWebClientId || !_cfg.userPoolDomain) {
    _enabled = false;
    return { enabled: false };
  }
  // Try to load Amplify from CDN lazily (keeps package.json untouched)
  try {
    if (!window.aws_amplify) {
      await loadScript('https://cdn.jsdelivr.net/npm/aws-amplify@5.3.12/dist/aws-amplify.min.js');
    }
    Amplify = window.aws_amplify;
    Auth = Amplify?.Auth;
    if (!Auth) throw new Error('Amplify Auth missing');

    Amplify.default.configure({
      Auth: {
        region: _cfg.region,
        userPoolId: _cfg.userPoolId,
        userPoolWebClientId: _cfg.userPoolWebClientId,
        oauth: {
          domain: _cfg.userPoolDomain,
          scope: ['openid', 'email', 'profile'],
          redirectSignIn: _cfg.redirectSignIn || window.location.origin + '/',
          redirectSignOut: _cfg.redirectSignOut || window.location.origin + '/',
          responseType: 'code'
        }
      }
    });
    _enabled = true;
  } catch {
    _enabled = false;
  }
  return { enabled: _enabled };
}

export function enabled() { return _enabled; }

export async function currentUser() {
  if (!_enabled) return null;
  try {
    const u = await Auth.currentAuthenticatedUser();
    const info = await Auth.currentUserInfo?.();
    return {
      id: u?.attributes?.sub || u?.username,
      name: info?.attributes?.name || u?.attributes?.name || 'Player',
      picture: info?.attributes?.picture || null
    };
  } catch { return null; }
}

export async function signInWithGoogle() {
  if (!_enabled) return;
  try { await Auth.federatedSignIn({ provider: 'Google' }); } catch {}
}
export async function signInWithFacebook() {
  if (!_enabled) return;
  try { await Auth.federatedSignIn({ provider: 'Facebook' }); } catch {}
}
export async function signOut() {
  if (!_enabled) return;
  try { await Auth.signOut(); window.location.assign('/'); } catch {}
}

export async function accessToken() {
  if (!_enabled) return null;
  try { const s = await Auth.currentSession(); return s?.getAccessToken?.().getJwtToken?.() || null; } catch { return null; }
}

export async function idToken() {
  if (!_enabled) return null;
  try { const s = await Auth.currentSession(); return s?.getIdToken?.().getJwtToken?.() || null; } catch { return null; }
}

export function rawConfig() { return _cfg; }

