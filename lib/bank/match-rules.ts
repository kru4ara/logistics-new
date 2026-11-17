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
  /** номер заказа (заявки) — его клиент пишет в назначении: CONTR.905, ORDER 908-07/069 */
  requestNumber: string | null;
  invoiceNumber: string | null;
  /** сумма к оплате: брутто фактуры клиенту, без фактуры — фрахт заказа */
  amount: number | null;
  currency: string | null;
  clientName: string | null;
  paid: boolean;
  /** счёт выставлен (или уже оплачен); без счёта приход — аванс */
  invoiced?: boolean;
  /** уже распределено на заказ из других приходов, в его валюте */
  allocated?: number;
};

export type Allocation = { tripId: string; amount: number };
export type TripMatch = Match & {
  /** как разложить платёж по заказам: на каждый — его остаток к оплате */
  allocations: Allocation[];
  /** не легло ни на один заказ — аванс / переплата */
  remainder: number;
};

/** Погрешность «оплачен полностью»: копейки и округления банка. */
export const SETTLE_TOLERANCE = 0.5;

/** Остаток к оплате по заказу (не меньше нуля); сумма неизвестна — null. */
export const outstanding = (t: Pick<TripRef, 'amount' | 'allocated'>) =>
  t.amount == null ? null : Math.max(0, Math.round((t.amount - (t.allocated ?? 0)) * 100) / 100);

/** Заказ оплачен полностью: распределено не меньше суммы к оплате. */
export const isSettled = (amount: number | null, allocated: number) =>
  amount != null && allocated >= amount - SETTLE_TOLERANCE;

/** Числа и номера из назначения: «CONTR.907, 902, 903,6776» → 907, 902, 903, 6776. */
export function numberTokens(title: string | null | undefined): string[] {
  const clean = (title ?? '')
    .replace(/\d{10}-\d{8}-[0-9A-F]+-[0-9A-F]+/gi, ' ') // номер KSeF
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ') // даты и номера вида 38/08/2026
    .replace(/\b(?:19|20)\d{2}\b/g, ' '); // годы
  return [...new Set(clean.match(/(?<!\d)\d{3,6}(?!\d)/g) ?? [])];
}

/** Разложить платёж по заказам по порядку: каждому — его остаток, сколько хватит. */
export function allocatePayment(amount: number, cur: string, trips: TripRef[]): { allocations: Allocation[]; remainder: number; covered: boolean } {
  let left = Math.round(amount * 100);
  const allocations: Allocation[] = [];
  let covered = true;
  for (const t of trips) {
    const due = (t.currency || 'EUR').toUpperCase() === cur ? outstanding(t) : null;
    if (due == null || due <= 0) {
      if (due == null) covered = false;
      continue;
    }
    const share = Math.min(left, Math.round(due * 100));
    if (share < Math.round(due * 100)) covered = false;
    if (share > 0) allocations.push({ tripId: t.id, amount: share / 100 });
    left -= share;
  }
  return { allocations, remainder: left / 100, covered };
}

/**
 * Заказы для прихода от клиента — в порядке упоминания: номер счёта клиенту в назначении
 * или номер заказа (CONTR.885, 886…, ORDER 908-07/069). Платёж раскладывается по их
 * остаткам; точно — если лёг без остатка и закрыл все найденные. Без номеров — один
 * неоплаченный заказ клиента с той же суммой (вероятно).
 */
export function matchTrips(tx: TxLike & { currency: string }, trips: TripRef[]): TripMatch | null {
  const amount = tx.amount;
  if (amount <= 0) return null;
  const cur = tx.currency.toUpperCase();
  const title = compact(tx.title);
  const raw = tx.title ?? '';
  const tokens = numberTokens(raw);
  const pos = (t: TripRef): number => {
    const inv = compact(t.invoiceNumber);
    if (inv.length >= 4 && title.includes(inv)) return title.indexOf(inv);
    // «908-07/069» целиком; «905» — отдельным числом. Номер заявки клиента, а если его
    // нет — номер заказа в CRM (у экспедиции — с буквой «Е»: «886Е» ↔ CONTR.886).
    for (const n of [t.requestNumber, t.tripNumber]) {
      const req = (n ?? '').trim().replace(/\s/g, '');
      if (!req) continue;
      const rc = compact(req);
      if (/[-/.]/.test(req) && rc.length >= 5 && title.includes(rc)) return title.indexOf(rc);
      const digits = req.replace(/[ЕE]$/i, '');
      if (/^\d{3,6}$/.test(digits) && tokens.includes(digits)) return raw.search(new RegExp(`(?<!\\d)${digits}(?!\\d)`));
    }
    return -1;
  };
  const found = trips
    .map((t) => ({ t, p: pos(t) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => a.p - b.p)
    .map((x) => x.t);
  if (found.length) {
    const { allocations, remainder, covered } = allocatePayment(amount, cur, found);
    return { ids: found.map((t) => t.id), exact: covered && Math.abs(remainder) < 0.005, allocations, remainder };
  }
  const same = trips.filter((t) => {
    const due = outstanding(t);
    return !t.paid && due != null && due > 0 && (t.currency || 'EUR').toUpperCase() === cur && cents(due) === cents(amount) && sameParty(tx.counterparty, t.clientName);
  });
  if (same.length !== 1) return null;
  return { ids: [same[0].id], exact: false, allocations: [{ tripId: same[0].id, amount }], remainder: 0 };
}
