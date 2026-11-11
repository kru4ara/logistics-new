const CACHE_NAME = 'logistics-crm-v2';

// Кэшируем только статику. HTML-документы НЕ кэшируем:
// приложение авторизуется по сессии, и закешированная страница
// отдаёт устаревший документ (и вызывает «страница постоянно
// обновляется»).
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll падает целиком, если хоть один файл не скачался —
      // поэтому добавляем по одному и не роняем установку.
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((error) => {
            console.warn('[sw] не удалось закэшировать', url, error);
          })
        )
      )
    )
  );
  // Без skipWaiting() в install: новая версия SW ждёт, пока все
  // вкладки закроются. Раньше skipWaiting() + clients.claim()
  // заставляли браузер переустанавливать SW на каждой загрузке.
});

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

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Только GET.
  if (request.method !== 'GET') return;

  // Расширения браузера (chrome-extension://) и не-HTTP схемы
  // Cache API не поддерживает — раньше здесь падало с
  // "Request scheme 'chrome-extension' is unsupported".
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API и служебные пути не кэшируем.
  if (url.pathname.startsWith('/api/')) return;

  // Навигационные запросы (HTML) не кэшируем: документ зависит от сессии.
  if (request.mode === 'navigate') return;

  // Кэшируем только реальную статику.
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icon-')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          // put без waitUntil мог отклониться уже после того, как
          // ответ ушёл клиенту. Теперь ошибку глушим и не роняем
          // цепочку — кэш здесь только ускоритель.
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch((error) => {
                console.warn('[sw] cache.put не удался:', error);
              })
          );
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
