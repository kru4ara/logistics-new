/**
 * Правила ограничения попыток входа — чистые функции без Supabase,
 * чтобы их можно было покрыть юнит-тестами (см. lib/login-throttle.ts).
 *
 * Скользящее окно: если за последние WINDOW_MS было не меньше LIMIT
 * неудачных попыток, вход закрыт до момента, когда самая старая из этих
 * LIMIT попыток выйдет из окна.
 */

export const WINDOW_MS = 15 * 60 * 1000;

/** Неудач на один аккаунт за окно. */
export const LOGIN_LIMIT = 5;

/**
 * Неудач с одного IP за окно. Выше, чем на аккаунт: офис и водители
 * могут выходить в сеть через один адрес.
 */
export const IP_LIMIT = 30;

export type ThrottleDecision = { blocked: false } | { blocked: true; retryAfterSec: number };

/**
 * @param failures времена неудачных попыток (в любом порядке)
 */
export function retryAfterSec(failures: readonly Date[], limit: number, now: Date): number {
  const inWindow = failures
    .map((d) => d.getTime())
    .filter((t) => now.getTime() - t < WINDOW_MS)
    .sort((a, b) => b - a); // новые сначала
  if (inWindow.length < limit) return 0;
  // Самая старая из последних `limit` попыток — когда она выйдет из окна,
  // в окне останется limit-1 попыток, и вход откроется.
  const oldestOfLimit = inWindow[limit - 1];
  return Math.max(1, Math.ceil((oldestOfLimit + WINDOW_MS - now.getTime()) / 1000));
}

export function evaluateThrottle(input: {
  loginFailures: readonly Date[];
  ipFailures: readonly Date[];
  now: Date;
}): ThrottleDecision {
  const wait = Math.max(
    retryAfterSec(input.loginFailures, LOGIN_LIMIT, input.now),
    retryAfterSec(input.ipFailures, IP_LIMIT, input.now)
  );
  return wait > 0 ? { blocked: true, retryAfterSec: wait } : { blocked: false };
}

/** «Слишком много попыток…» с округлением до минут вверх. */
export function throttleMessage(retryAfterSec: number): string {
  const min = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Слишком много неудачных попыток. Попробуйте через ${min} мин.`;
}

/** Ключ аккаунта: e-mail в нижнем регистре без пробелов по краям. */
export function normalizeLoginKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * IP клиента. На Vercel первый адрес в x-forwarded-for выставляет сама
 * платформа (клиентский заголовок перезаписывается).
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const fwd = headers.get('x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim();
  if (first) return first;
  return headers.get('x-real-ip')?.trim() || null;
}
