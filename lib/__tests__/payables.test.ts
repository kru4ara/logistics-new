import { describe, it, expect } from 'vitest';
import {
  normalizeNip, carrierOrderNumber, mentionsOrder, suggestSegments, autoMatch,
  type SegmentCandidate, type PurchaseForMatch,
} from '../payables/match-rules';
import { summarizePayables, type PayableRow } from '../payables/summary';

const seg = (o: Partial<SegmentCandidate> = {}): SegmentCandidate => ({
  id: 's1', tripId: 't1', tripNumber: '77', clientRequestNumber: '6877', position: 1,
  contractorId: 'c1', contractorName: 'Trans-Kowalski', contractorNip: 'PL5261040828',
  price: 2900, currency: 'EUR', dateFrom: '2026-11-10', dateTo: '2026-11-13', linked: false, ...o,
});
const inv = (o: Partial<PurchaseForMatch> = {}): PurchaseForMatch => ({
  sellerNip: '5261040828', invoiceNumber: 'FV 15/11/2026', issueDate: '2026-11-14', net: 2900, gross: 2900,
  currency: 'EUR', description: 'Usługa transportowa, zlecenie 6877-1', ...o,
});

describe('сопоставление счёта подрядчика', () => {
  it('нормализация и номер заявки', () => {
    expect(normalizeNip('PL 526-104-08-28')).toBe('5261040828');
    expect(normalizeNip('')).toBeNull();
    expect(carrierOrderNumber(seg())).toBe('6877-1');
    expect(carrierOrderNumber(seg({ clientRequestNumber: null, position: 2 }))).toBe('77-2');
    expect(mentionsOrder('zlecenie 6877-1.', '6877-1')).toBe(true);
    expect(mentionsOrder('zlecenie 16877-1', '6877-1')).toBe(false);
    expect(mentionsOrder('zlecenie 6877-12', '6877-1')).toBe(false);
    expect(mentionsOrder('FV 6877-1/2026', '6877-1')).toBe(false);
  });

  it('номер заявки + NIP + сумма → автопривязка', () => {
    const segs = [seg(), seg({ id: 's2', clientRequestNumber: '6900', price: 2900 })];
    const sug = suggestSegments(inv(), segs);
    expect(sug[0]).toMatchObject({ segmentId: 's1', reasons: ['order', 'nip', 'amount', 'date'] });
    expect(autoMatch(sug, segs)).toBe('s1');
  });

  it('без номера заявки: NIP + сумма + даты — однозначно', () => {
    const segs = [seg(), seg({ id: 's2', price: 1200 })];
    const sug = suggestSegments(inv({ description: 'Transport' }), segs);
    expect(autoMatch(sug, segs)).toBe('s1');
  });

  it('два одинаковых участка — не угадываем', () => {
    const segs = [seg(), seg({ id: 's2', clientRequestNumber: '6900' })];
    const sug = suggestSegments(inv({ description: 'Transport' }), segs);
    expect(sug).toHaveLength(2);
    expect(autoMatch(sug, segs)).toBeNull();
  });

  it('чужой NIP и нет номера — не кандидат; занятый участок не берём', () => {
    expect(suggestSegments(inv({ sellerNip: '1111111111', description: '' }), [seg()])).toEqual([]);
    const segs = [seg({ linked: true })];
    // доплата / korekta с номером заявки — к участку, у которого уже есть счёт
    expect(autoMatch(suggestSegments(inv(), segs), segs)).toBe('s1');
    // без номера заявки (только NIP + сумма) — к занятому участку не привязываем
    expect(autoMatch(suggestSegments(inv({ description: 'Transport' }), segs), segs)).toBeNull();
  });

  it('даты далеко — штраф, автопривязки только по NIP+сумме нет', () => {
    const segs = [seg({ dateFrom: '2025-01-01', dateTo: '2025-01-05' })];
    const sug = suggestSegments(inv({ description: 'Transport' }), segs);
    expect(autoMatch(sug, segs)).toBeNull();
  });
});

const row = (o: Partial<PayableRow>): PayableRow => ({
  id: 'p', ksef_number: 'k', invoice_number: 'FV', issue_date: '2026-11-01', seller_nip: '1', seller_name: 'A',
  net_amount: 100, gross_amount: 100, currency: 'EUR', payment_due: '2026-12-01', description: null,
  segment_id: null, match_status: 'none', paid_at: null, ...o,
});

describe('сводка кредиторки', () => {
  it('к оплате, просрочено, без привязки, оплаченные', () => {
    const s = summarizePayables([
      row({ id: 'a', segment_id: 's', match_status: 'auto', payment_due: '2026-11-10', gross_amount: 300 }),
      row({ id: 'b', currency: 'PLN', gross_amount: 1230, match_status: 'ignored' }),
      row({ id: 'c' }),
      row({ id: 'd', paid_at: '2026-11-05', segment_id: 's2', match_status: 'manual' }),
      row({ id: 'e', paid_at: '2026-01-05' }),
    ], '2026-11-15');
    expect(s.unmatched.map((r) => r.id)).toEqual(['c']);
    expect(s.toPay.map((r) => r.id)).toEqual(['a', 'b']);
    expect(s.paidRecent.map((r) => r.id)).toEqual(['d']);
    expect(s.unpaidByCurrency).toEqual([{ currency: 'PLN', amount: 1230 }, { currency: 'EUR', amount: 400 }]);
    expect(s.overdueByCurrency).toEqual([{ currency: 'EUR', amount: 300 }]);
  });
});
