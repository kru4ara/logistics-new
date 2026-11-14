import 'server-only';

import { createHash } from 'node:crypto';
import { createClient as createAdminClient } from './supabase/admin';
import { evaluateThrottle, IP_LIMIT, LOGIN_LIMIT, WINDOW_MS, type ThrottleDecision } from './login-throttle-rules';

/**
 * Хранение неудачных попыток входа — таблица public.login_failures
 * (миграция 019). Доступ только service_role (RLS без политик).
 *
 * Логин и IP храним хэшами: таблица — журнал попыток, личные данные
 * в ней не нужны.
 *
 * При любой ошибке БД (таблицы ещё нет, сеть) — НЕ блокируем вход:
 * ограничитель не должен запирать всех пользователей.
 */

const TABLE = 'login_failures';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function loginHash(loginKey: string): string {
  return sha256(`login:${loginKey}`);
}

export function ipHash(ip: string | null): string | null {
  return ip ? sha256(`ip:${ip}`) : null;
}

async function recentFailures(column: 'login_hash' | 'ip_hash', value: string, limit: number, since: string) {
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .select('created_at')
    .eq(column, value)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => new Date(r.created_at as string));
}

export async function checkLoginThrottle(loginKey: string, ip: string | null): Promise<ThrottleDecision> {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_MS).toISOString();
    const ipH = ipHash(ip);
    const [loginFailures, ipFailures] = await Promise.all([
      recentFailures('login_hash', loginHash(loginKey), LOGIN_LIMIT, since),
      ipH ? recentFailures('ip_hash', ipH, IP_LIMIT, since) : Promise.resolve([]),
    ]);
    return evaluateThrottle({ loginFailures, ipFailures, now });
  } catch (e) {
    console.error('[login-throttle] check failed, allowing login:', (e as Error).message);
    return { blocked: false };
  }
}

export async function recordLoginFailure(loginKey: string, ip: string | null): Promise<void> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from(TABLE).insert({ login_hash: loginHash(loginKey), ip_hash: ipHash(ip) });
    if (error) throw new Error(error.message);
    // Чистка: старше суток журнал не нужен. Дёшево — индекс по created_at.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from(TABLE).delete().lt('created_at', dayAgo);
  } catch (e) {
    console.error('[login-throttle] record failed:', (e as Error).message);
  }
}

/** Успешный вход сбрасывает счётчик аккаунта (IP-счётчик не трогаем). */
export async function clearLoginFailures(loginKey: string): Promise<void> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from(TABLE).delete().eq('login_hash', loginHash(loginKey));
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('[login-throttle] clear failed:', (e as Error).message);
  }
}
