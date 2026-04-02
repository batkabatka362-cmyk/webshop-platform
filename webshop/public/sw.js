const CACHE_NAME = 'webshop-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/global.css',
  '/js/storefront.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response if found
      if (response) return response;
      
      // Fallback to network
      return fetch(event.request).catch(() => {
        // Here you could return a custom offline page
        if (event.request.headers.get('accept').includes('text/html')) {
           return caches.match('/');
        }
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
                  .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
