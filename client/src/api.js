/**
 * Thin API client for the JHJ authentication gateway.
 *
 * The gateway issues an httpOnly session cookie; `credentials: 'include'`
 * carries it on every request. No credentials or tokens are kept in
 * localStorage.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (_) {
    const err = new Error('Cannot reach the authentication server. Is it running?');
    err.status = 0;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status}).`);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }

  if (data && typeof data.token === 'string') setAccessToken(data.token);
  return data;
}

export const authApi = {
  step1: (payload) => request('/api/auth/step1', { method: 'POST', body: payload, auth: false }),
  step2: (payload) => request('/api/auth/step2', { method: 'POST', body: payload, auth: false }),
  register: (payload) =>
    request('/api/auth/register-teammate', { method: 'POST', body: payload, auth: false }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  updateSecurity: (payload) => request('/api/user/security', { method: 'PUT', body: payload }),
  team: () => request('/api/team'),
  verifyCreator: (payload) =>
    request('/api/team/verify-creator', { method: 'POST', body: payload })
};
