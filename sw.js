const CACHE_NAME = 'playzone-v2';
const GAMES_CACHE = 'games-cache-v1';
const OFFLINE_URL = '/offline.html';

// Core app files to cache for PWA
const CORE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/games.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache core app files
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(CORE_CACHE.map(url => new Request(url, { cache: 'reload' })));
      }),
      // Create games cache
      caches.open(GAMES_CACHE)
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Keep current caches, delete old ones
          if (key !== CACHE_NAME && key !== GAMES_CACHE) {
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

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
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
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If in standalone mode (PWA), show main app instead of offline page
          const isStandalone = await clients.matchAll({ type: 'window' }).then(clients => {
            return clients.some(client => client.url.includes('display-mode=standalone'));
          });
          
          if (isStandalone) {
            return caches.match('/index.html');
          }
          
          // Otherwise show offline page
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Handle game iframe requests (for downloaded games)
  if (request.url.includes('gamepix.com') || request.url.includes('playgama.com')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then(response => {
            // Only cache successful responses
            if (response.ok && request.url.includes('/embed')) {
              const responseClone = response.clone();
              caches.open(GAMES_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Handle API requests (games.json)
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
          const cached = await caches.match(request);
          return cached || new Response('[]', {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle static assets (images, icons, etc.)
  if (request.url.includes('/icons/') || request.url.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
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
          });
        })
        .catch(() => {
          // Return a placeholder image if offline and not cached
          return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#1a1f3a" width="100" height="100"/></svg>', {
            headers: { 'Content-Type': 'image/svg+xml' }
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
        return caches.match(request);
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
