// 현대어 성경 PWA - 서비스 워커
const CACHE_NAME = 'bible-v2';
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './books/index.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first 전략 (성경 데이터는 거의 안 바뀜)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && (e.request.url.includes('.json') || e.request.url.includes('.html') || e.request.url.includes('.css') || e.request.url.includes('.js'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
