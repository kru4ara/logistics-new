// KSeF API 2.0 — чистые правила (без сети): окружения, выбор ключа, разбор FA(3).
// Покрыты тестами. Сеть — lib/ksef/client.ts.
import { XMLParser } from 'fast-xml-parser';

export type KsefEnv = 'prod' | 'demo' | 'test';

export const KSEF_BASE_URL: Record<KsefEnv, string> = {
  prod: 'https://api.ksef.mf.gov.pl/v2',
  demo: 'https://api-demo.ksef.mf.gov.pl/v2',
  test: 'https://api-test.ksef.mf.gov.pl/v2',
};

export const ksefEnv = (v: string | undefined): KsefEnv =>
  v === 'demo' || v === 'test' ? v : 'prod';

/** Окно запроса метаданных — не больше 100 дней (лимит KSeF), берём с запасом. */
export const MAX_WINDOW_DAYS = 90;

export type PublicKeyCert = { certificate: string; publicKeyId?: string; validFrom: string; validTo: string; usage: string[] };

/** Действующий сертификат MF для шифрования токена KSeF. */
export function pickTokenCert(certs: PublicKeyCert[], now = new Date()): PublicKeyCert | null {
  const t = now.getTime();
  const ok = certs.filter(
    (c) => c.usage?.includes('KsefTokenEncryption') && Date.parse(c.validFrom) <= t && t < Date.parse(c.validTo),
  );
  // Самый свежий из действующих.
  ok.sort((a, b) => Date.parse(b.validFrom) - Date.parse(a.validFrom));
  return ok[0] ?? null;
}

/** Статус входа: 100 — в процессе, 200 — готово, остальное — ошибка. */
export function authStatus(code: number | undefined): 'pending' | 'ok' | 'error' {
  if (code === 100) return 'pending';
  if (code === 200) return 'ok';
  return 'error';
}

/** Данные входящей фактуры из XML FA(3). */
export type PurchaseInvoiceData = {
  invoiceNumber: string | null;
  issueDate: string | null;
  sellerNip: string | null;
  sellerName: string | null;
  currency: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  paymentDue: string | null;
  bankAccount: string | null;
  /** позиции и доп. описание одной строкой — по ним ищем номер заявки */
  description: string | null;
  invoiceType: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ['FaWiersz', 'DodatkowyOpis', 'TerminPlatnosci', 'RachunekBankowy'].includes(name),
});

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(typeof v === 'object' ? '' : v).trim();
  return s || null;
};
const money = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const sum = (vals: (number | null)[]) => {
  const xs = vals.filter((x): x is number => x !== null);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

// Нетто по ставкам (P_13_1 … P_13_11) и НДС (P_14_1 … P_14_5) — FA(3).
const NET_FIELDS = ['P_13_1', 'P_13_2', 'P_13_3', 'P_13_4', 'P_13_5', 'P_13_6_1', 'P_13_6_2', 'P_13_6_3', 'P_13_7', 'P_13_8', 'P_13_9', 'P_13_10', 'P_13_11'];
const VAT_FIELDS = ['P_14_1', 'P_14_2', 'P_14_3', 'P_14_4', 'P_14_5'];

export function parseFa3(xml: string): PurchaseInvoiceData {
  const doc = parser.parse(xml) as Record<string, any>;
  const f = doc?.Faktura ?? {};
  const fa = f.Fa ?? {};
  const seller = f.Podmiot1?.DaneIdentyfikacyjne ?? {};
  const pay = fa.Platnosc ?? {};
  const lines: string[] = [];
  for (const w of fa.FaWiersz ?? []) {
    const t = str(w?.P_7);
    if (t) lines.push(t);
  }
  for (const d of fa.DodatkowyOpis ?? []) {
    const k = str(d?.Klucz);
    const v = str(d?.Wartosc);
    if (v) lines.push(k ? `${k}: ${v}` : v);
  }
  const due = (pay.TerminPlatnosci ?? []).map((x: any) => str(x?.Termin)).find(Boolean) ?? null;
  const account = (pay.RachunekBankowy ?? []).map((x: any) => str(x?.NrRB)).find(Boolean) ?? null;
  return {
    invoiceNumber: str(fa.P_2),
    issueDate: str(fa.P_1),
    sellerNip: str(seller.NIP),
    sellerName: str(seller.Nazwa),
    currency: str(fa.KodWaluty),
    net: sum(NET_FIELDS.map((k) => money(fa[k]))),
    vat: sum(VAT_FIELDS.map((k) => money(fa[k]))),
    gross: money(fa.P_15),
    paymentDue: due,
    bankAccount: account,
    description: lines.length ? lines.join('\n').slice(0, 4000) : null,
    invoiceType: str(fa.RodzajFaktury),
  };
}

/** Окна по ≤ MAX_WINDOW_DAYS от from до to (ISO). */
export function dateWindows(fromIso: string, toIso: string): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let a = Date.parse(fromIso);
  const end = Date.parse(toIso);
  const step = MAX_WINDOW_DAYS * 86_400_000;
  while (a < end) {
    const b = Math.min(a + step, end);
    out.push({ from: new Date(a).toISOString(), to: new Date(b).toISOString() });
    a = b;
  }
  return out;
}
