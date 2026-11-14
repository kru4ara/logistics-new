/**
 * Оповещения о сбоях сервера — правила без сети (покрыты тестом).
 * Отправка — lib/error-alerts.ts, подключение — instrumentation.ts (onRequestError).
 *
 * Сообщение уходит владельцу системы (общий чат поддержки для всех компаний),
 * поэтому в нём нет данных пользователя: ни заголовков, ни cookie, ни query-строки.
 */

/** Служебные «ошибки» Next: редирект, notFound, переход на динамический рендер — не сбои. */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'NEXT_HTTP_ERROR_FALLBACK', 'DYNAMIC_SERVER_USAGE', 'BAILOUT_TO_CLIENT_SIDE_RENDERING'];

export function errorDigest(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

export function shouldReport(err: unknown): boolean {
  const digest = errorDigest(err) ?? '';
  const message = errorMessage(err);
  return !CONTROL_FLOW.some((c) => digest.startsWith(c) || message.startsWith(c));
}

/** Путь без query-строки: в ней бывают поисковые запросы и id. */
export function safePath(path: string): string {
  return path.split('?')[0].slice(0, 200);
}

export type AlertInput = {
  tenant: string;
  env: string;
  err: unknown;
  method: string;
  path: string;
  routeType: string;
  routePath: string;
  at: Date;
};

export function formatAlert(a: AlertInput): string {
  const message = errorMessage(a.err).replace(/\s+/g, ' ').slice(0, 600);
  const digest = errorDigest(a.err);
  const lines = [
    `🔴 Сбой · ${a.tenant}${a.env === 'production' ? '' : ` (${a.env})`}`,
    `${a.method} ${safePath(a.path)}`,
    `${a.routeType} · ${a.routePath}`,
    '',
    message,
  ];
  if (digest) lines.push('', `digest: ${digest}`);
  lines.push(`🕐 ${a.at.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  return lines.join('\n');
}

/**
 * Не чаще одного сообщения на одинаковую ошибку в окне `windowMs` — иначе одна
 * сломанная страница засыплет чат. Память — в пределах экземпляра сервера.
 */
export function createThrottle(windowMs: number, maxKeys = 200) {
  const last = new Map<string, number>();
  return (key: string, now: number): boolean => {
    const prev = last.get(key);
    if (prev !== undefined && now - prev < windowMs) return false;
    if (last.size >= maxKeys) last.delete(last.keys().next().value as string);
    last.set(key, now);
    return true;
  };
}
