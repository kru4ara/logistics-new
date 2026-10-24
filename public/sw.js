const CACHE_NAME = 'logistics-crm-v1';
const STATIC_ASSETS = [
  '/',
  '/driver',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

// Установка: кэшируем статику
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Фетч: стратегия "Network First" (сначала интернет, потом кэш)
self.addEventListener('fetch', (event) => {
  // Пропускаем POST-запросы и запросы к API (они не кэшируются)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если ответ успешный — клонируем и кладём в кэш
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Если интернета нет — отдаём из кэша
        return caches.match(event.request);
      })
  );
});
