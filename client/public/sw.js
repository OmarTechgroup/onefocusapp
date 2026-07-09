// OneFocus service worker.
// Strategy: cache-first for the app shell (static assets), network-first
// for /api calls (fresh data, falls back to cache when offline).
// Firebase Cloud Messaging background handling lives in firebase-messaging-sw.js,
// which importScripts() this file's CACHE_NAME so both stay in sync — see that file.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `onefocus-shell-${CACHE_VERSION}`;
const API_CACHE = `onefocus-api-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'Pas de connexion et rien en cache.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const fallback = await cache.match('/index.html');
    return fallback || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') {
    // Non-GET API writes: let them hit the network directly; offline queueing
    // for mutations (check-ins, step completion, capture) is handled client-side
    // via IndexedDB in the offline-first phase.
    return;
  }
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
  }
});
