/**
 * Отправить ошибку браузера на сервер (app/api/client-error). Без зависимостей —
 * вызывается из страницы ошибки и из ClientErrorReporter.
 * Не больше 5 отчётов за загрузку страницы: зациклившийся компонент не засыплет чат.
 */
let sent = 0;

export function reportClientError(error: unknown): void {
  if (typeof window === 'undefined' || sent >= 5) return;
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : JSON.stringify(error);
  if (!message || /ResizeObserver loop|Loading chunk|ChunkLoadError|NEXT_REDIRECT/.test(message)) return;
  sent++;
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.slice(0, 500), path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // отчёт об ошибке не должен сам ломать страницу
  }
}
