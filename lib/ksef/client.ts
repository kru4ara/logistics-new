import 'server-only';
import { X509Certificate, publicEncrypt, constants } from 'node:crypto';
import { KSEF_BASE_URL, ksefEnv, pickTokenCert, authStatus, type PublicKeyCert } from './rules';

// Клиент KSeF API 2.0 — только чтение входящих фактур, вход по токену KSeF.
// Переменные проекта Vercel:
//   KSEF_TOKEN — токен из Aplikacja Podatnika KSeF (право «przeglądanie faktur» / InvoiceRead)
//   KSEF_NIP   — NIP компании (контекст входа)
//   KSEF_ENV   — prod (по умолчанию) | demo | test
// KSEF_API_URL — только для тестов (заглушка).

export class KsefError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

export const isKsefConfigured = () => Boolean(process.env.KSEF_TOKEN && /^\d{10}$/.test(process.env.KSEF_NIP ?? ''));

const base = () => (process.env.KSEF_API_URL || KSEF_BASE_URL[ksefEnv(process.env.KSEF_ENV)]).replace(/\/$/, '');

async function call<T>(path: string, init: RequestInit & { token?: string; accept?: string } = {}): Promise<T> {
  const { token, accept, ...rest } = init;
  const res = await fetch(`${base()}${path}`, {
    ...rest,
    headers: {
      Accept: accept ?? 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      const ex = j?.exception?.exceptionDetailList?.[0];
      msg = ex ? `${ex.exceptionCode}: ${ex.exceptionDescription}` : j?.title || j?.detail || j?.message || msg;
    } catch {
      if (text) msg = `${msg}: ${text.slice(0, 200)}`;
    }
    if (res.status === 429) msg = `KSeF: limit zapytań (429). ${res.headers.get('retry-after') ? `Retry-After ${res.headers.get('retry-after')} s` : ''}`.trim();
    throw new KsefError(msg, res.status);
  }
  if ((accept ?? 'application/json') !== 'application/json') return text as T;
  return (text ? JSON.parse(text) : null) as T;
}

let cached: { token: string; until: number } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** accessToken: challenge → шифрование «токен|время» ключом MF → ожидание входа → redeem. */
export async function accessToken(): Promise<string> {
  if (cached && cached.until - Date.now() > 60_000) return cached.token;
  const token = process.env.KSEF_TOKEN;
  const nip = process.env.KSEF_NIP;
  if (!token || !nip) throw new KsefError('KSEF_TOKEN / KSEF_NIP is not set');

  const [challenge, certs] = await Promise.all([
    call<{ challenge: string; timestampMs: number }>('/auth/challenge', { method: 'POST' }),
    call<PublicKeyCert[]>('/security/public-key-certificates'),
  ]);
  const cert = pickTokenCert(certs);
  if (!cert) throw new KsefError('no valid KsefTokenEncryption certificate');
  const key = new X509Certificate(Buffer.from(cert.certificate, 'base64')).publicKey;
  const encryptedToken = publicEncrypt(
    { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(`${token}|${challenge.timestampMs}`, 'utf8'),
  ).toString('base64');

  const init = await call<{ referenceNumber: string; authenticationToken: { token: string } }>('/auth/ksef-token', {
    method: 'POST',
    body: JSON.stringify({
      challenge: challenge.challenge,
      contextIdentifier: { type: 'Nip', value: nip },
      encryptedToken,
    }),
  });
  const authToken = init.authenticationToken.token;

  for (let i = 0; ; i++) {
    const st = await call<{ status: { code: number; description: string; details?: string[] } }>(
      `/auth/${encodeURIComponent(init.referenceNumber)}`,
      { token: authToken },
    );
    const s = authStatus(st.status?.code);
    if (s === 'ok') break;
    if (s === 'error') {
      throw new KsefError(`${st.status?.code} ${st.status?.description}${st.status?.details?.length ? ': ' + st.status.details.join('; ') : ''}`);
    }
    if (i >= 20) throw new KsefError('KSeF: authentication timeout');
    await sleep(i < 5 ? 500 : 1500);
  }

  const tokens = await call<{ accessToken: { token: string; validUntil: string } }>('/auth/token/redeem', {
    method: 'POST',
    token: authToken,
  });
  cached = { token: tokens.accessToken.token, until: Date.parse(tokens.accessToken.validUntil) || Date.now() + 10 * 60_000 };
  return cached.token;
}

/** Сбросить кеш токена (для тестов и после 401). */
export const resetKsefToken = () => {
  cached = null;
};

export type InvoiceMetadata = {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  permanentStorageDate: string;
  seller: { nip: string; name?: string | null };
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  invoiceType: string;
};

type MetadataPage = {
  hasMore: boolean;
  isTruncated: boolean;
  permanentStorageHwmDate?: string;
  invoices: InvoiceMetadata[];
};

/**
 * Входящие фактуры (Subject2) по дате записи в KSeF, по возрастанию, с HWM.
 * Возвращает фактуры и момент, до которого KSeF гарантирует полноту (hwm).
 */
export async function queryPurchaseMetadata(fromIso: string, toIso?: string): Promise<{ invoices: InvoiceMetadata[]; hwm: string | null }> {
  const token = await accessToken();
  const out: InvoiceMetadata[] = [];
  let from = fromIso;
  let offset = 0;
  let hwm: string | null = null;
  for (let guard = 0; guard < 40; guard++) {
    const page = await call<MetadataPage>(`/invoices/query/metadata?pageOffset=${offset}&pageSize=250&sortOrder=Asc`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        subjectType: 'Subject2',
        dateRange: { dateType: 'PermanentStorage', from, ...(toIso ? { to: toIso } : {}), restrictToPermanentStorageHwmDate: true },
      }),
    });
    out.push(...page.invoices);
    hwm = page.permanentStorageHwmDate ?? hwm;
    if (!page.hasMore) break;
    if (page.isTruncated && page.invoices.length) {
      from = page.invoices[page.invoices.length - 1].permanentStorageDate;
      offset = 0;
    } else {
      offset++;
    }
  }
  return { invoices: out, hwm };
}

/** XML фактуры FA(3) по номеру KSeF. */
export async function downloadInvoiceXml(ksefNumber: string): Promise<string> {
  const token = await accessToken();
  return call<string>(`/invoices/ksef/${encodeURIComponent(ksefNumber)}`, { token, accept: 'application/xml' });
}
