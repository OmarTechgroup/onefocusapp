import { enqueue } from './offline/queue';

const BASE = '/api';

// Mutations the spec explicitly requires to keep working offline: check-in,
// step completion, quick capture. Everything else surfaces the network error
// as-is (no point silently queueing e.g. a task creation with server-side
// validation the client can't replicate).
const OFFLINE_QUEUEABLE = [
  { method: 'POST', pattern: /^\/checkins$/ },
  { method: 'POST', pattern: /^\/inbox$/ },
  { method: 'POST', pattern: /^\/tasks\/[^/]+\/steps\/[^/]+\/complete$/ },
];

function isQueueable(method, path) {
  return OFFLINE_QUEUEABLE.some((r) => r.method === method && r.pattern.test(path));
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  try {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.message || res.statusText);
      err.code = data?.error;
      throw err;
    }
    return data;
  } catch (e) {
    // A thrown TypeError (not an HTTP error response) means the network
    // request itself failed — genuinely offline, not a server-side rejection.
    if (e instanceof TypeError && isQueueable(method, path)) {
      const body = options.body ? JSON.parse(options.body) : null;
      await enqueue({ path, method, body });
      return { queued: true, ...body };
    }
    throw e;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
