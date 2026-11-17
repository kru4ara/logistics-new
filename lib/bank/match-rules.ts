// Операции выписки: вид операции и что ей соответствует в CRM — чистые правила (тесты).
import type { ParsedTx } from './pko-rules';

export type TxKind =
  | 'internal' // между своими счетами, обмен валют
  | 'fee' // комиссии банка
  | 'tax' // ZUS, PIT/VAT
  | 'cash' // наличные (банкомат, касса) и «zwrot kosztów» людям
  | 'card' // покупка картой
  | 'client' // приход от клиента
  | 'supplier' // перевод с фактурой в назначении
  | 'other_in'
  | 'other_out';

type TxLike = Pick<ParsedTx, 'type' | 'amount' | 'counterparty' | 'counterpartyAccount' | 'title' | 'description'>;

const has = (s: string | null | undefined, re: RegExp) => re.test(s ?? '');

/** Вид операции по типу PKO, назначению и счёту контрагента. ownAccounts — счета компании. */
export function classifyTx(tx: TxLike, ownAccounts: string[]): TxKind {
  const own = new Set(ownAccounts);
  if (tx.counterpartyAccount && own.has(tx.counterpartyAccount)) return 'internal';
  if (has(tx.type, /OPERACJĄ SKARBOWĄ/) || has(tx.description, /^FX\d+ [A-Z]{3}\/[A-Z]{3}/)) return 'internal';
  if (has(tx.type, /PROW\.|PROWIZJA|OPŁATA/)) return 'fee';
  if (has(tx.type, /NZUS|US VAT|US PIT/) || has(tx.counterparty, /ZAKŁAD UBEZPIECZEŃ SPOŁECZNYCH|URZĄD SKARBOWY/)) return 'tax';
  if (has(tx.type, /^WYPŁATA/)) return 'cash';
  if (has(tx.type, /ZAKUP PRZY UŻYCIU KARTY/)) return 'card';
  if (tx.amount > 0) return has(tx.counterparty, /\S/) ? 'client' : 'other_in';
  if (has(tx.title, /ZWROT KOSZT|WZROT/i)) return 'cash';
  if (has(tx.title, /FAKTUR|\bFV\b|\bF\/|\bFA\/|\bFS\b|\bDEW\/|\d{6,}/i)) return 'supplier';
  return 'other_out';
}

/** Категория общих расходов по умолчанию для операций без счёта. */
export function defaultOverhead(kind: TxKind, tx: TxLike): string | null {
  if (kind === 'fee') return 'bank_fees';
  if (kind === 'tax') return 'taxes';
  if (kind === 'card' && has(tx.counterparty, /STACJA|PALIW|ORLEN|BP |SHELL|CIRCLE|MOYA|AMIC/i)) return 'fuel';
  if (has(tx.title, /WYNAGRODZ|UMOWA O DZIEŁO|PENSJA/i)) return 'salary';
  if (has(tx.counterparty, /MINISTERSTWO FINANS/i) || has(tx.title, /E-?TOLL/i)) return 'tolls';
  if (has(tx.title, /NAJEM|WYNAJEM/i)) return 'rent';
  if (has(tx.title, /POLISA|UBEZPIECZ/i) || has(tx.counterparty, /PZU|COMPENSA|WARTA|ERGO/i)) return 'insurance';
  return null;
}

// ── Сопоставление со счетами подрядчиков ──

export type PurchaseRef = {
  id: string;
  number: string | null;
  sellerName: string | null;
  gross: number | null;
  currency: string | null;
  issueDate: string | null;
};

export type Match = { ids: string[]; exact: boolean };

const compact = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cents = (n: number) => Math.round(n * 100);
const day = (d: string) => Math.round(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
const STOP = new Set(['SP', 'ZOO', 'SPOLKA', 'SPÓŁKA', 'Z', 'O', 'OO', 'S', 'A', 'SA', 'FIRMA', 'PL', 'LLC', 'LTD', 'TRANS', 'TRANSPORT', 'USŁUGI', 'USLUGI', 'HANDLOWO', 'USŁUGOWA', 'OGRANICZONĄ', 'ODPOWIEDZIALNOŚCIĄ', 'SPOL', 'SRO', 'KOMANDYTOWA', 'JAWNA', 'AGENCJA', 'CELNA']);
const words = (s: string | null | undefined) =>
  new Set((s ?? '').toUpperCase().split(/[^A-ZĄĆĘŁŃÓŚŹŻ0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));
/** Похоже ли название из банка на продавца/клиента: общее значимое слово. */
export const sameParty = (a: string | null | undefined, b: string | null | undefined) => {
  const wa = words(a);
  for (const w of words(b)) if (wa.has(w)) return true;
  return false;
};

/**
 * Счета подрядчиков для исходящего платежа:
 * • номера счетов в назначении (один или несколько) и сумма брутто сходится — точно;
 * • номер в назначении, сумма не сходится — вероятно (частичная оплата, комиссия);
 * • без номера: та же сумма и валюта, продавец похож по названию, дата счёта за 60 дней
 *   до платежа (для карты — ±5 дней, продавец не обязателен) — вероятно, если кандидат один.
 */
export function matchPurchases(
  tx: TxLike & { bookingDate: string; currency: string },
  kind: TxKind,
  invoices: PurchaseRef[],
): Match | null {
  const amount = -tx.amount;
  if (amount <= 0) return null;
  const cur = tx.currency.toUpperCase();
  const sameCur = invoices.filter((i) => (i.currency || 'PLN').toUpperCase() === cur);
  const title = compact(tx.title);
  // Куски назначения: «FASWA/573/2026, FASWA/572/2026» → два номера; «1601/SR/2026» найдёт «FS 1601/SR/2026».
  const pieces = (tx.title ?? '').split(/[\s,;]+/).map(compact).filter((x) => x.length >= 5 && /\d/.test(x));
  if (title) {
    const byNumber = sameCur.filter((i) => {
      const n = compact(i.number);
      if (n.length < 4) return false;
      return title.includes(n) || pieces.some((p) => n.endsWith(p) || n.startsWith(p));
    });
    if (byNumber.length) {
      const sum = byNumber.reduce((s, i) => s + (i.gross ?? 0), 0);
      return { ids: byNumber.map((i) => i.id), exact: cents(sum) === cents(amount) };
    }
  }
  const d = day(tx.bookingDate);
  const sameAmount = sameCur.filter((i) => i.gross != null && cents(i.gross) === cents(amount) && i.issueDate);
  const within = (i: PurchaseRef, from: number, to: number) => {
    const diff = d - day(i.issueDate!);
    return diff >= from && diff <= to;
  };
  if (kind === 'card') {
    const c = sameAmount.filter((i) => within(i, -5, 5));
    return c.length === 1 ? { ids: [c[0].id], exact: false } : null;
  }
  const named = sameAmount.filter((i) => within(i, -3, 60) && sameParty(tx.counterparty, i.sellerName));
  if (named.length === 1) return { ids: [named[0].id], exact: false };
  // Платёжный посредник (PayPro за Trans.eu): название другое — только если сумма одна такая.
  const any = sameAmount.filter((i) => within(i, -3, 45));
  return !named.length && any.length === 1 ? { ids: [any[0].id], exact: false } : null;
}

// ── Сопоставление с заказами (дебиторка) ──

export type TripRef = {
  id: string;
  tripNumber: string | null;
  requestNumber: string | null;
  invoiceNumber: string | null;
  /** сумма фактуры клиенту и её валюта */
  amount: number | null;
  currency: string | null;
  clientName: string | null;
  paid: boolean;
};

/** Числа и номера из назначения: «CONTR.907, 902, 903,6776» → 907, 902, 903, 6776. */
export function numberTokens(title: string | null | undefined): string[] {
  const clean = (title ?? '')
    .replace(/\d{10}-\d{8}-[0-9A-F]+-[0-9A-F]+/gi, ' ') // номер KSeF
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ') // даты и номера вида 38/08/2026
    .replace(/\b(?:19|20)\d{2}\b/g, ' '); // годы
  return [...new Set(clean.match(/(?<!\d)\d{3,6}(?!\d)/g) ?? [])];
}

/**
 * Заказы для прихода от клиента: номер счёта клиенту в назначении или номера заказов /
 * заявок (CONTR.885, 886…). Сумма счетов сходится с платежом — точно; иначе вероятно.
 * Без номеров — один неоплаченный заказ клиента с той же суммой (вероятно).
 */
export function matchTrips(tx: TxLike & { currency: string }, trips: TripRef[]): Match | null {
  const amount = tx.amount;
  if (amount <= 0) return null;
  const title = compact(tx.title);
  const tokens = new Set(numberTokens(tx.title));
  const found = trips.filter((t) => {
    const inv = compact(t.invoiceNumber);
    if (inv.length >= 4 && title.includes(inv)) return true;
    return [t.tripNumber, t.requestNumber].some((n) => n && tokens.has(String(n).replace(/\D/g, '')));
  });
  const cur = tx.currency.toUpperCase();
  const sumOf = (xs: TripRef[]) => xs.reduce((s, t) => s + ((t.currency || 'EUR').toUpperCase() === cur ? t.amount ?? 0 : 0), 0);
  if (found.length) return { ids: found.map((t) => t.id), exact: cents(sumOf(found)) === cents(amount) };
  const same = trips.filter(
    (t) => !t.paid && t.amount != null && (t.currency || 'EUR').toUpperCase() === cur && cents(t.amount) === cents(amount) && sameParty(tx.counterparty, t.clientName),
  );
  return same.length === 1 ? { ids: [same[0].id], exact: false } : null;
}
