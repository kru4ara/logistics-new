// Дубли счетов подрядчика и дата оплаты — чистые правила (тесты).
import { normalizeNip } from './match-rules';

type DupRow = {
  id: string;
  source?: 'ksef' | 'manual';
  seller_nip: string | null;
  invoice_number: string | null;
  segment_id: string | null;
};

/** Ключ «продавец + номер»: «PL507-009-88-63» и «5070098863», «FV/397/09/2026 » и «fv/397/09/2026» — один счёт. */
export function invoiceKey(nip: string | null | undefined, number: string | null | undefined): string | null {
  const n = normalizeNip(nip);
  const num = (number ?? '').toLowerCase().replace(/\s+/g, '');
  return n && num ? `${n}|${num}` : null;
}

/** Группы счетов с одинаковым продавцом и номером (2+ строки) — вероятные дубли. */
export function findDuplicateGroups<T extends DupRow>(rows: T[]): T[][] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = invoiceKey(r.seller_nip, r.invoice_number);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.values()].filter((g) => g.length > 1);
}

/**
 * Ручной счёт, который потом пришёл из KSeF: перенести привязку и оплату в строку KSeF
 * и удалить ручную. Только когда это однозначно: ровно одна из KSeF и одна ручная, и
 * строка KSeF не привязана к другому участку (иначе решает человек).
 */
export function planManualMerge<T extends DupRow>(group: T[]): { keep: T; drop: T } | null {
  if (group.length !== 2) return null;
  const keep = group.find((r) => r.source !== 'manual');
  const drop = group.find((r) => r.source === 'manual');
  if (!keep || !drop) return null;
  if (keep.segment_id && drop.segment_id && keep.segment_id !== drop.segment_id) return null;
  return { keep, drop };
}

/** Дата оплаты: YYYY-MM-DD, не в будущем и не раньше 2000 года. */
export function isValidPaidDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) return false;
  return date >= '2000-01-01' && date <= today;
}
