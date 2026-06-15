const CACHE_NAME = 'entrelinhas-pwa-v244-push-safe';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL).catch(function() {
        return undefined;
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    var keys = await caches.keys();

    await Promise.all(
      keys
        .filter(function(key) {
          return key !== CACHE_NAME && key.indexOf('entrelinhas-pwa-') === 0;
        })
        .map(function(key) {
          return caches.delete(key);
        })
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  var url;

  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (req.method !== 'GET') return;
  if (url.hostname.indexOf('supabase.co') !== -1) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate') {
    event.respondWith((async function() {
      try {
        var fresh = await fetch(req, { cache: 'no-store' });
        var cache = await caches.open(CACHE_NAME);

        cache.put('./index.html', fresh.clone()).catch(function() {
          return undefined;
        });

        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());

    return;
  }

  event.respondWith((async function() {
    var cached = await caches.match(req);

    if (cached) return cached;

    try {
      var fresh = await fetch(req);
      var cache = await caches.open(CACHE_NAME);

      cache.put(req, fresh.clone()).catch(function() {
        return undefined;
      });

      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});

/* EntreLinhas - Push Notifications PWA */

function normalizeNotificationUrl(rawUrl) {
  var fallbackScope = './';

  try {
    if (self.registration && self.registration.scope) {
      fallbackScope = self.registration.scope;
    }
  } catch (e) {
    fallbackScope = './';
  }

  if (!rawUrl) return fallbackScope;

  try {
    var text = String(rawUrl);

    if (text.indexOf('http://') === 0 || text.indexOf('https://') === 0) {
      return text;
    }

    if (text.indexOf('/?') === 0) {
      return fallbackScope.replace(/\/$/, '') + text.substring(1);
    }

    if (text.indexOf('?') === 0) {
      return fallbackScope.replace(/\/$/, '') + '/' + text;
    }

    return new URL(text, fallbackScope).href;
  } catch (e) {
    return fallbackScope;
  }
}

self.addEventListener('push', function(event) {
  var payload = {};

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    try {
      payload = {
        title: 'EntreLinhas',
        body: event.data ? event.data.text() : 'Você recebeu uma nova notificação.'
      };
    } catch (ignore) {
      payload = {};
    }
  }

  var title = payload.title || 'EntreLinhas';
  var body = payload.body || 'Você recebeu uma nova notificação.';
  var data = payload.data || {};

  var targetUrl = normalizeNotificationUrl(payload.url || data.url || './');

  var options = {
    body: body,
    icon: payload.icon || './icon-192.png',
    badge: payload.badge || './icon-192.png',
    tag: payload.tag || 'entrelines-notification',
    renotify: true,
    vibrate: [120, 60, 120],
    data: {
      url: targetUrl,
      type: data.type || payload.type || 'generic',
      id: data.id || payload.id || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = './';

  try {
    if (event.notification && event.notification.data && event.notification.data.url) {
      url = event.notification.data.url;
    }
  } catch (e) {
    url = './';
  }

  var targetUrl = normalizeNotificationUrl(url);

  event.waitUntil((async function() {
    var windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (var i = 0; i < windowClients.length; i++) {
      var client = windowClients[i];

      try {
        var clientUrl = new URL(client.url);
        var target = new URL(targetUrl);

        if (clientUrl.origin === target.origin) {
          await client.focus();

          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }

          return;
        }
      } catch (e) {
        // tenta o próximo cliente
      }
    }

    return clients.openWindow(targetUrl);
  })());
});

self.addEventListener('notificationclose', function() {
  // reservado para métricas futuras
});
