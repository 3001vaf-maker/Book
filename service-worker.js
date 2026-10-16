const STATIC_CACHE_PREFIX = 'va-static-';

function versionedStaticRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.searchParams.get('build')) return false;
  return /\.(?:js|mjs|css)$/i.test(url.pathname);
}

function versionedAssetResponse(request, event) {
  let cacheWrite = Promise.resolve();
  const responsePromise = (async () => {
    const url = new URL(request.url);
    const build = String(url.searchParams.get('build') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'build';
    const cacheName = `${STATIC_CACHE_PREFIX}${build}`;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      cacheWrite = (async () => {
        await cache.put(request, response.clone());
        const names = await caches.keys();
        await Promise.all(names
          .filter((name) => name.startsWith(STATIC_CACHE_PREFIX) && name !== cacheName)
          .map((name) => caches.delete(name)));
      })();
    }
    return response;
  })();

  event.waitUntil(responsePromise.then(() => cacheWrite).catch(() => {}));
  return responsePromise;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (!versionedStaticRequest(event.request)) return;
  event.respondWith(versionedAssetResponse(event.request, event));
});

async function syncAppBadge(count) {
  const value = Math.max(0, Math.trunc(Number(count) || 0));
  try {
    if (value > 0 && typeof self.registration.setAppBadge === 'function') {
      await self.registration.setAppBadge(value);
    } else if (value <= 0 && typeof self.registration.clearAppBadge === 'function') {
      await self.registration.clearAppBadge();
    }
  } catch {}
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text?.() || '' };
  }

  const title = String(payload.title || 'VA Tools');
  const options = {
    body: String(payload.body || ''),
    tag: String(payload.tag || payload.notificationId || ''),
    renotify: false,
    data: {
      url: String(payload.url || '/'),
      notificationId: String(payload.notificationId || ''),
    },
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    syncAppBadge(payload.badgeCount),
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'va-tools:badge') return;
  event.waitUntil(syncAppBadge(event.data?.count));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification?.data?.url || '/', self.location.origin).toString();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    return null;
  })());
});
