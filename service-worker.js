const CACHE_NAME = 'workout-tracker-shell-v4';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(cacheName =>
              cacheName !== CACHE_NAME
            )
            .map(cacheName =>
              caches.delete(cacheName)
            )
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseCopy = response.clone();

        caches
          .open(CACHE_NAME)
          .then(cache => {
            cache.put(
              event.request,
              responseCopy
            );
          });

        return response;
      })
      .catch(() =>
        caches.match(event.request)
      )
  );
});
