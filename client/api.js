// api.js — Thin HTTP client with auto token refresh
// Access token lives in memory only (XSS protection)

let _accessToken = null;
let _refreshing = null; // Promise lock to prevent concurrent refresh calls

// API_BASE is injected by the build step (netlify.toml sed replacement).
// Falls back to '' (same origin) for local dev where the placeholder is unreplaced.
const _apiBase = (() => {
  const b = window.API_BASE || '';
  return b.includes('__BACKEND') ? '' : b.replace(/\/$/, '');
})();

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

async function refreshToken() {
  if (_refreshing) return _refreshing;

  _refreshing = fetch(_apiBase + '/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).then(async (r) => {
    if (!r.ok) throw new Error('Refresh failed');
    const data = await r.json();
    _accessToken = data.accessToken;
    return data.accessToken;
  }).finally(() => {
    _refreshing = null;
  });

  return _refreshing;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const opts = {
    method,
    headers,
    credentials: 'include',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(_apiBase + path, opts);

  // Token expired — try to refresh once
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED' || body.error === 'Token expired') {
      try {
        await refreshToken();
        headers['Authorization'] = `Bearer ${_accessToken}`;
        res = await fetch(_apiBase + path, { ...opts, headers });
      } catch {
        clearAccessToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expired. Please log in again.');
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, details: err.details });
  }

  return res.json();
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};

export default api;
