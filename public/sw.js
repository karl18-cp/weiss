const CACHE = 'weiss-sales-v2';
const APP_SHELL = [
  '/manifest.webmanifest',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/images/weiss-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode === 'navigate') return;

  const requestUrl = new URL(event.request.url);
  const isAppShellAsset = requestUrl.origin === self.location.origin
    && APP_SHELL.includes(requestUrl.pathname);

  // Never cache Inertia page responses or API/data requests. Those responses
  // contain live CRM totals and lead statuses and must always come from the
  // server. Only the small, immutable PWA shell is available offline.
  if (!isAppShellAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
    )
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Weiss Sales', {
      body: data.body || 'You have a new update.',
      icon: data.icon || '/pwa/icon-192.png',
      badge: data.badge || '/pwa/icon-192.png',
      data: { url: data.url || '/salesman/booking-board' },
      tag: data.tag,
      renotify: Boolean(data.tag)
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/salesman/booking-board', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      return existing ? existing.focus().then(() => existing.navigate(target)) : clients.openWindow(target);
    })
  );
});
