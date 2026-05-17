// Service worker: Network-first strategy for fresh builds, fallback for offline.
// Supports all browsers: Chrome, Firefox, Safari, Edge, Opera.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  // Network-first strategy: try network, fall back to cache if offline
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        return response;
      })
      .catch(() => {
        // On network failure, attempt to serve from cache for offline support
        return caches.match(request);
      })
  );
});
