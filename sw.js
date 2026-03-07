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
          // No internet - show offline page
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return offlinePage;
          }
          
          // Fallback if offline page not cached
          return new Response(
            `<!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Offline</title>
              <style>
                body {
                  background: linear-gradient(180deg, #0b0f1a, #0e1330);
                  color: #fff;
                  font-family: 'Outfit', system-ui, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  text-align: center;
                  padding: 20px;
                }
                .icon { font-size: 80px; margin-bottom: 20px; }
                h1 { color: #ff5c5c; margin: 0 0 10px; }
                p { color: #9aa3c7; }
              </style>
            </head>
            <body>
              <div>
                <div class="icon">📡</div>
                <h1>You're Offline</h1>
                <p>Check your internet connection and try again.</p>
              </div>
            </body>
            </html>`,
            { 
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            }
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
