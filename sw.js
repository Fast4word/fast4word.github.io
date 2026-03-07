const CACHE_NAME = 'playzone-v3';
const OFFLINE_URL = '/offline.html';

// Core app files to cache for PWA
const CORE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/games.json',
  OFFLINE_URL
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_CACHE.map(url => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Delete old caches
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests (page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              // Updates the cache for the page currently being visited
              cache.put(request, responseClone);
              
              // BACKGROUND UPDATE: Keep the offline page fresh
              // cache.put OVERWRITES the old file, so storage doesn't grow
              fetch(OFFLINE_URL).then(offRes => {
                if (offRes.ok) cache.put(OFFLINE_URL, offRes);
              }).catch(() => {/* fail silently if background fetch fails */});
            });
          }
          return response;
        })
        .catch(async () => {
          // No internet - show the updated offline page from cache
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          
          // Fallback if offline page somehow isn't in cache
          return new Response(
            `<!DOCTYPE html><html><body><h1>You're Offline</h1></body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }


  // Handle games.json API request
  if (request.url.includes('games.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Try cache first
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          // Return empty array if not cached
          return new Response('[]', {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle static assets (images, icons, fonts)
  if (request.url.includes('/icons/') || request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          }).catch(() => {
            // Return placeholder for images if offline
            if (request.url.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
              return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#1a1f3a" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#9aa3c7" font-size="14">?</text></svg>`,
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            // Return empty response for fonts
            return new Response('', { status: 200 });
          });
        })
    );
    return;
  }

  // All other requests - network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response('Not found', { status: 404 });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(keys.map(key => caches.delete(key)));
      })
    );
  }
});
