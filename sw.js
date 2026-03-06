// The 'install' event is required for the browser to allow installation
self.addEventListener('install', (event) => {
  // Forces the waiting service worker to become the active service worker
  self.skipWaiting();
});

// The 'activate' event fires once the SW is installed
self.addEventListener('activate', (event) => {
  // Allows the SW to take control of the page immediately
  event.waitUntil(self.clients.claim());
});

// The 'fetch' event is required for PWA status. 
// This version just fetches from the network normally.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
