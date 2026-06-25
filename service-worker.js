/* EntreLinhas PWA 1.0 — v468 */
'use strict';

const PWA_VERSION = '1.0.7-v468';
const CACHE_PREFIX = 'entrelinhas-pwa-';
const SHELL_CACHE = CACHE_PREFIX + PWA_VERSION + '-shell';
const RUNTIME_CACHE = CACHE_PREFIX + PWA_VERSION + '-runtime';
const MAX_RUNTIME_ENTRIES = 80;

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

function isHttp(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableResponse(response) {
  return !!response && response.ok && response.status === 200 && (response.type === 'basic' || response.type === 'default');
}

function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (!isHttp(url)) return true;
  if (!isSameOrigin(url)) return true;
  if (request.headers.has('range')) return true;

  const path = url.pathname.toLowerCase();
  if (/\.(epub|pdf|mp3|m4a|wav|ogg|mp4|webm|zip)(?:$|\?)/i.test(path)) return true;
  if (path.includes('/rest/v1/') || path.includes('/auth/v1/') || path.includes('/storage/v1/') || path.includes('/functions/v1/')) return true;
  return false;
}

function isStaticAsset(url) {
  return /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|json|webmanifest)$/i.test(url.pathname);
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    const oldest = keys.shift();
    if (oldest) await cache.delete(oldest);
  }
}

async function putSafe(cacheName, request, response) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (cacheName === RUNTIME_CACHE) await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
}

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(APP_SHELL);
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function(key) {
      return key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE;
    }).map(function(key) {
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', function(event) {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'PWA_VERSION', version: PWA_VERSION });
  }
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (shouldBypass(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async function() {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (isCacheableResponse(response)) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (e) {
        return (await caches.match(request, { ignoreSearch: true })) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./offline.html')) ||
               Response.error();
      }
    })());
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith((async function() {
    const cached = await caches.match(request);
    const network = fetch(request).then(async function(response) {
      if (isCacheableResponse(response)) await putSafe(RUNTIME_CACHE, request, response);
      return response;
    }).catch(function() { return null; });

    if (cached) {
      event.waitUntil(network);
      return cached;
    }

    const fresh = await network;
    return fresh || Response.error();
  })());
});

/* Notificações push */
function normalizeNotificationUrl(rawUrl) {
  let scope = './';
  try { scope = self.registration.scope || './'; } catch (e) {}
  if (!rawUrl) return scope;
  try {
    const text = String(rawUrl);
    if (/^https?:\/\//i.test(text)) return text;
    if (text.startsWith('/?')) return scope.replace(/\/$/, '') + text.substring(1);
    if (text.startsWith('?')) return scope.replace(/\/$/, '') + '/' + text;
    return new URL(text, scope).href;
  } catch (e) {
    return scope;
  }
}

self.addEventListener('push', function(event) {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    try { payload = { body: event.data ? event.data.text() : '' }; } catch (ignore) {}
  }

  const data = payload.data || {};
  const title = payload.title || 'EntreLinhas';
  const body = payload.body || 'Você recebeu uma nova notificação.';
  const targetUrl = normalizeNotificationUrl(payload.url || data.url || './');
  const identity = data.id || payload.id || Date.now();
  const type = data.type || payload.type || 'generic';
  const tag = payload.tag || ('entrelinhas-' + type + '-' + identity);

  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: payload.icon || './icon-192.png',
    badge: payload.badge || './icon-192.png',
    tag: tag,
    renotify: !!payload.renotify,
    vibrate: [120, 60, 120],
    data: { url: targetUrl, type: type, id: identity },
    timestamp: Number(payload.timestamp || Date.now())
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification && event.notification.data || {};
  const targetUrl = normalizeNotificationUrl(data.url || './');

  event.waitUntil((async function() {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(targetUrl);
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        if (current.origin === target.origin) {
          await client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
          return;
        }
      } catch (e) {}
    }
    return clients.openWindow(targetUrl);
  })());
});
