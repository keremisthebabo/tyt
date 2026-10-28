const CACHE_NAME = 'net-defterim-tyt-kampi-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/net-defterim.css',
  './js/app.js',
  './js/curriculum.js',
  './js/scheduler.js',
  './js/auth-storage.js',
  './js/meb-topics.js',
  './js/net-defterim-core.js',
  './public/logo-white.png',
  './public/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
