import 'server-only';

// Клиент API Fakturownia. Секреты — в переменных окружения проекта Vercel:
//   FAKTUROWNIA_DOMAIN     — поддомен аккаунта: «firma» из firma.fakturownia.pl
//   FAKTUROWNIA_API_TOKEN  — Ustawienia → Ustawienia konta → Integracja → Kod autoryzacyjny API
// FAKTUROWNIA_API_URL — только для тестов (заглушка вместо настоящего API).

export type FakturowniaInvoice = {
  id: number;
  number: string | null;
  issue_date?: string | null;
  payment_to?: string | null;
  status?: string | null;
  gov_status?: string | null;
  gov_id?: string | null;
  gov_error_messages?: unknown;
  gov_verification_link?: string | null;
};

export class FakturowniaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Поддомен аккаунта: только буквы, цифры и дефис — чтобы адрес нельзя было подменить. */
export function fakturowniaDomain(): string | null {
  const raw = (process.env.FAKTUROWNIA_DOMAIN ?? '').trim().toLowerCase().replace(/\.fakturownia\.pl\/?$/, '').replace(/^https?:\/\//, '');
  return /^[a-z0-9-]{1,63}$/.test(raw) ? raw : null;
}

export const isFakturowniaConfigured = () => Boolean(fakturowniaDomain() && process.env.FAKTUROWNIA_API_TOKEN);

function baseUrl(): string {
  if (process.env.FAKTUROWNIA_API_URL) return process.env.FAKTUROWNIA_API_URL.replace(/\/$/, '');
  const d = fakturowniaDomain();
  if (!d) throw new FakturowniaError('FAKTUROWNIA_DOMAIN не задан', 0);
  return `https://${d}.fakturownia.pl`;
}

/** Текст ошибки из ответа API: {"code":"error","message":{...}} или {"message":"..."}. */
function errorText(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const m = (body as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (m && typeof m === 'object') {
      return Object.entries(m as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('; ');
    }
  }
  return `HTTP ${status}`;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.FAKTUROWNIA_API_TOKEN;
  if (!token) throw new FakturowniaError('FAKTUROWNIA_API_TOKEN не задан', 0);
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  return res;
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await call(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new FakturowniaError(errorText(body, res.status), res.status);
  return body as T;
}

/** Создать фактуру; sendToKsef — сразу поставить в очередь отправки в KSeF. */
export function createInvoice(payload: unknown, sendToKsef: boolean) {
  return json<FakturowniaInvoice>(`/invoices.json${sendToKsef ? '?gov_save_and_send=1' : ''}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const getInvoice = (id: number) => json<FakturowniaInvoice>(`/invoices/${id}.json`);

/** Повторно отправить в KSeF уже созданную фактуру (после исправления ошибки). */
export function resendToKsef(id: number) {
  return json<FakturowniaInvoice>(`/invoices/${id}.json?gov_save_and_send=1`, {
    method: 'PUT',
    body: JSON.stringify({ invoice: {} }),
  });
}

/** Отметить оплату в Fakturownia. */
export async function markPaid(id: number): Promise<void> {
  const res = await call(`/invoices/${id}/change_status.json?status=paid`, { method: 'POST' });
  if (!res.ok) throw new FakturowniaError(errorText(await res.json().catch(() => null), res.status), res.status);
}

/** PDF фактуры (с номером KSeF и QR-кодом, когда он уже присвоен). */
export async function getInvoicePdf(id: number): Promise<ArrayBuffer> {
  const res = await call(`/invoices/${id}.pdf`, { headers: { Accept: 'application/pdf' } });
  if (!res.ok) throw new FakturowniaError(`HTTP ${res.status}`, res.status);
  return res.arrayBuffer();
}
