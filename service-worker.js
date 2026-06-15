```js
const CACHE_NAME = 'entrelinhas-pwa-v243-push';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME && key.startsWith('entrelinhas-pwa-'))
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);

        cache.put('./index.html', fresh.clone()).catch(() => undefined);

        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());

    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);

    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);

      cache.put(req, fresh.clone()).catch(() => undefined);

      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});

/* =========================================================
   EntreLinhas v243 - Push Notifications PWA
   Mantém o cache antigo e adiciona notificações push.
   ========================================================= */

function normalizeNotificationUrl(rawUrl) {
  const fallbackScope = self.registration && self.registration.scope
    ? self.registration.scope
    : './';

  if (!rawUrl) return fallbackScope;

  try {
    const text = String(rawUrl);

    if (text.startsWith('http://') || text.startsWith('https://')) {
      return text;
    }

    /*
      Se vier "/?open=chat", em GitHub Pages isso poderia abrir a raiz do domínio.
      Aqui corrigimos para abrir dentro do escopo real do app.
    */
    if (text.startsWith('/?')) {
      return fallbackScope.replace(/\/$/, '') + text.slice(1);
    }

    if (text.startsWith('?')) {
      return fallbackScope.replace(/\/$/, '') + '/' + text;
    }

    return new URL(text, fallbackScope).href;
  } catch (e) {
    return fallbackScope;
  }
}

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = {
        title: 'EntreLinhas',
        body: event.data ? event.data.text() : 'Você recebeu uma nova notificação.'
      };
    } catch (_) {
      payload = {};
    }
  }

  const title = payload.title || 'EntreLinhas';
  const body = payload.body || 'Você recebeu uma nova notificação.';

  const targetUrl = normalizeNotificationUrl(
    payload.url ||
    payload?.data?.url ||
    './'
  );

  const options = {
    body,
    icon: payload.icon || './icon-192.png',
    badge: payload.badge || './icon-192.png',
    tag: payload.tag || 'entrelines-notification',
    renotify: true,
    vibrate: [120, 60, 120],
    data: {
      ...(payload.data || {}),
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = normalizeNotificationUrl(
    event.notification?.data?.url || './'
  );

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windowClients) {
      try {
        const clientUrl = new URL(client.url);
        const target = new URL(targetUrl);

        if (clientUrl.origin === target.origin) {
          await client.focus();

          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }

          return;
        }
      } catch (e) {
        // Ignora cliente inválido e tenta abrir novo.
      }
    }

    return clients.openWindow(targetUrl);
  })());
});

self.addEventListener('notificationclose', () => {
  // Reservado para métricas futuras, sem fazer nada agora.
});
```
