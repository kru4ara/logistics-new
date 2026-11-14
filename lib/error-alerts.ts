import 'server-only';

import { createThrottle, errorDigest, errorMessage, formatAlert, safePath, shouldReport } from './error-alerts-rules';

/**
 * Сбои сервера → Telegram владельца системы.
 *
 * Переменные окружения (во всех проектах Vercel одинаковые, кроме TENANT_NAME):
 *   OPS_TELEGRAM_BOT_TOKEN — бот поддержки (ваш, не бот клиента)
 *   OPS_TELEGRAM_CHAT_ID   — чат, куда слать
 *   TENANT_NAME            — имя компании в сообщении (иначе — домен приложения)
 * Не заданы — ничего не отправляется.
 */

const throttle = createThrottle(30 * 60 * 1000);

function tenantName(): string {
  if (process.env.TENANT_NAME) return process.env.TENANT_NAME;
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'unknown';
}

async function send(text: string): Promise<void> {
  const token = process.env.OPS_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OPS_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.error('[error-alerts] не удалось отправить в Telegram:', (e as Error).message);
  }
}

/** Ошибка в браузере (app/api/client-error). Пользователь уже проверен роутом. */
export async function reportClientError(input: { message: string; path: string; role: string }): Promise<void> {
  if (!process.env.OPS_TELEGRAM_BOT_TOKEN || !process.env.OPS_TELEGRAM_CHAT_ID) return;
  const message = input.message.slice(0, 500);
  const key = `client|${safePath(input.path)}|${message.slice(0, 120)}`;
  if (!throttle(key, Date.now())) return;
  await send(formatAlert({
    tenant: tenantName(),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    err: new Error(message),
    method: 'BROWSER',
    path: input.path,
    routeType: 'client',
    routePath: `роль ${input.role}`,
    at: new Date(),
  }));
}

export async function reportServerError(
  err: unknown,
  request: { path: string; method: string },
  context: { routeType: string; routePath: string },
): Promise<void> {
  const token = process.env.OPS_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OPS_TELEGRAM_CHAT_ID;
  if (!token || !chatId || !shouldReport(err)) return;

  const key = `${context.routePath}|${errorDigest(err) ?? errorMessage(err).slice(0, 120)}|${safePath(request.path)}`;
  if (!throttle(key, Date.now())) return;

  const text = formatAlert({
    tenant: tenantName(),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    err,
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routePath: context.routePath,
    at: new Date(),
  });

  await send(text);
}
