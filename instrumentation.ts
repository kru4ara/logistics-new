import type { Instrumentation } from 'next';

/**
 * Сбои на сервере (рендер, route handlers, server actions, proxy) → Telegram владельца.
 * Сама отправка и фильтры — lib/error-alerts.ts. Только Node.js-рантайм.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { reportServerError } = await import('./lib/error-alerts');
    await reportServerError(err, request, context);
  } catch {
    // оповещение не должно ломать обработку запроса
  }
};
