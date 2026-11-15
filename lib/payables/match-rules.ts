// Сопоставление входящей фактуры подрядчика с участком рейса — чистые правила (тесты).
//
// Ключи по силе:
//   1. номер нашей заявки перевозчику «<номер>-<участок>» (как в DOCX-заявке) в тексте фактуры;
//   2. NIP подрядчика + сумма участка (нетто или брутто, допуск 1 ед. / 0,5 %) + валюта;
//   3. даты: фактура не раньше начала участка и не позже чем через 120 дней после конца.
// Автоматически привязываем только однозначный вариант; остальное — подсказки для офиса.

export type SegmentCandidate = {
  id: string;
  tripId: string;
  tripNumber: string | null;
  clientRequestNumber: string | null;
  position: number;
  contractorId: string | null;
  contractorName: string | null;
  contractorNip: string | null;
  price: number | null;
  currency: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  /** уже есть привязанная фактура */
  linked: boolean;
};

export type PurchaseForMatch = {
  sellerNip: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  net: number | null;
  gross: number | null;
  currency: string | null;
  description: string | null;
};

export type MatchSuggestion = { segmentId: string; score: number; reasons: ('order' | 'nip' | 'amount' | 'date')[] };

/** NIP без префикса страны, пробелов и дефисов: «PL 701-116-29-39» → «7011162939». */
export function normalizeNip(v: string | null | undefined): string | null {
  const s = (v ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (!s) return null;
  return /^[A-Z]{2}\d/.test(s) ? s.slice(2) : s;
}

/** Номер нашей заявки перевозчику — как в DOCX: «<заявка клиента | номер рейса>-<участок>». */
export const carrierOrderNumber = (s: Pick<SegmentCandidate, 'clientRequestNumber' | 'tripNumber' | 'position'>) =>
  `${s.clientRequestNumber ?? s.tripNumber ?? '?'}-${s.position || 1}`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Номер заявки встречается в тексте отдельным словом (а не частью другого числа). */
export function mentionsOrder(text: string | null, order: string): boolean {
  if (!text || !order || order.startsWith('?')) return false;
  return new RegExp(`(^|[^\\w/-])${escapeRe(order)}($|[^\\w/-])`, 'i').test(text);
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);

const DAY = 86_400_000;
function dateFits(issue: string | null, from: string | null, to: string | null): boolean {
  if (!issue) return true;
  const t = Date.parse(issue);
  const start = Date.parse(from ?? to ?? '');
  const end = Date.parse(to ?? from ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  return t >= start - 3 * DAY && t <= end + 120 * DAY;
}

export function suggestSegments(inv: PurchaseForMatch, segments: SegmentCandidate[]): MatchSuggestion[] {
  const nip = normalizeNip(inv.sellerNip);
  const out: MatchSuggestion[] = [];
  for (const s of segments) {
    const reasons: MatchSuggestion['reasons'] = [];
    let score = 0;
    const order = mentionsOrder(`${inv.description ?? ''}\n${inv.invoiceNumber ?? ''}`, carrierOrderNumber(s));
    if (order) {
      reasons.push('order');
      score += 60;
    }
    const sameNip = Boolean(nip && normalizeNip(s.contractorNip) === nip);
    if (sameNip) {
      reasons.push('nip');
      score += 25;
    }
    const sameCurrency = !inv.currency || !s.currency || inv.currency === s.currency;
    const amount =
      s.price != null && sameCurrency &&
      ((inv.net != null && close(inv.net, s.price)) || (inv.gross != null && close(inv.gross, s.price)));
    if (amount) {
      reasons.push('amount');
      score += 20;
    }
    if (dateFits(inv.issueDate, s.dateFrom, s.dateTo)) {
      reasons.push('date');
      score += 5;
    } else {
      score -= 30;
    }
    // Без NIP и без номера заявки совпадение суммы — случайность.
    if (!order && !sameNip) continue;
    // У участка уже есть счёт: доплату/korekta берём только по номеру заявки.
    if (s.linked && !order) score -= 40;
    if (score > 0) out.push({ segmentId: s.id, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Автопривязка: лучший вариант однозначен — номер заявки, или NIP + сумма (в подходящие даты),
 * и второй вариант заметно слабее. К участку, у которого уже есть счёт (доплата, korekta), —
 * только по номеру заявки.
 */
export function autoMatch(suggestions: MatchSuggestion[], segments: SegmentCandidate[]): string | null {
  const [best, second] = suggestions;
  if (!best) return null;
  const seg = segments.find((s) => s.id === best.segmentId);
  if (!seg) return null;
  // К участку со счётом — только доплата с номером нашей заявки.
  if (seg.linked && !best.reasons.includes('order')) return null;
  const strong =
    best.reasons.includes('order') ||
    (best.reasons.includes('nip') && best.reasons.includes('amount') && best.reasons.includes('date'));
  if (!strong) return null;
  if (second && second.score >= best.score - 10) return null;
  return best.segmentId;
}
