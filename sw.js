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
          
          // Check if we're in standalone/PWA mode by checking if there are any clients
          const allClients = await clients.matchAll({ type: 'window' });
          const isStandalone = allClients.length > 0 && (
            allClients[0].url.includes('?standalone') ||
            self.registration.scope.includes('standalone')
          );
          
          // In PWA mode, show main app; in browser mode, show offline page
          const fallbackPage = isStandalone ? '/index.html' : OFFLINE_URL;
          return caches.match(fallbackPage);
        })
    );
    return;
  }

  // Handle game metadata requests
  if (request.url.includes('game-meta-')) {
    event.respondWith(
      caches.match(request).then(response => response || fetch(request))
    );
    return;
  }

  // Handle game iframe requests (for downloaded games)
  if (request.url.includes('gamepix.com') || request.url.includes('playgama.com')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached version
            return cachedResponse;
          }
          
          // Try to fetch from network
          return fetch(request).then(response => {
            // Don't cache on-the-fly unless it's a deliberate download
            return response;
          }).catch(async () => {
            // If offline and not cached, return error page
            return new Response(
              `<!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    background: linear-gradient(180deg, #0b0f1a, #0e1330);
                    color: #fff;
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                    padding: 20px;
                  }
                  .container {
                    max-width: 400px;
                  }
                  h1 {
                    color: #ff5c5c;
                    font-size: 1.5rem;
                    margin-bottom: 1rem;
                  }
                  p {
                    color: #9aa3c7;
                    line-height: 1.6;
                  }
                  .icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">⚠️</div>
                  <h1>Game Not Available Offline</h1>
                  <p>This game hasn't been downloaded yet.</p>
                  <p>Connect to the internet and use the download button to play offline.</p>
                </div>
              </body>
              </html>`,
              { 
                status: 503,
                headers: { 'Content-Type': 'text/html' }
              }
            );
          });
        })
    );
    return;
  }

  // Handle game assets (JS, CSS, images from game servers)
  if (request.url.match(/\.(js|css|woff2?|ttf|eot)$/i) && 
      (request.url.includes('gamepix.com') || request.url.includes('playgama.com') || 
       request.url.includes('googleapis.com') || request.url.includes('gstatic.com'))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).catch(() => {
            // Return empty response for missing assets
            const ext = request.url.split('.').pop().toLowerCase();
            const contentTypes = {
              'js': 'application/javascript',
              'css': 'text/css',
              'woff': 'font/woff',
              'woff2': 'font/woff2',
              'ttf': 'font/ttf',
              'eot': 'application/vnd.ms-fontobject'
            };
            return new Response('', {
              headers: { 'Content-Type': contentTypes[ext] || 'text/plain' }
            });
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
          return fetch(request, { mode: 'cors' }).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          }).catch(async () => {
            // Try with no-cors as fallback
            try {
              const noCorsResponse = await fetch(request, { mode: 'no-cors' });
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, noCorsResponse.clone());
              });
              return noCorsResponse;
            } catch (e) {
              // Return a placeholder image if offline and not cached
              return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#1a1f3a" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#9aa3c7" font-size="14">?</text></svg>`,
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
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
