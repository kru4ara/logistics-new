import { describe, it, expect } from 'vitest';
import { guessSeller, groupBySeller, sellerKey, isOverheadCategory, type IgnoredRow } from '../payables/overhead-rules';

const r = (id: string, o: Partial<IgnoredRow> = {}): IgnoredRow => ({
  id, seller_nip: '5381745394', seller_name: 'BIURO RACHUNKOWE MAGDALENA RUSEK', invoice_number: id, issue_date: '2026-11-04',
  gross_amount: 100, net_amount: 81.3, currency: 'PLN', paid_at: '2026-11-15', overhead_category: null, ...o,
});

describe('подсказка по продавцу', () => {
  it('агентства — к рейсам, остальное — в накладные', () => {
    expect(guessSeller('AGENCJA CELNA "TERMINUS" E.S. GRYGATOWICZ')).toEqual({ assignment: 'trip' });
    expect(guessSeller('POLBALT SP. Z O.O.')).toEqual({ assignment: 'trip' });
    expect(guessSeller('BIURO RACHUNKOWE MAGDALENA RUSEK DORADCA PODATKOWY')).toEqual({ assignment: 'overhead', category: 'accounting' });
    expect(guessSeller('Trans.eu Group S.A.')).toEqual({ assignment: 'overhead', category: 'software' });
    expect(guessSeller('"REDROB" SERWIS TACHOGRAFÓW')).toEqual({ assignment: 'overhead', category: 'vehicle_service' });
    expect(guessSeller('PAJERO Sp. z o.o.')).toEqual({ assignment: 'overhead', category: 'vehicle_parts' });
    expect(guessSeller('Poczta Polska Spółka Akcyjna')).toEqual({ assignment: 'overhead', category: 'office' });
    expect(guessSeller('Tirserwis24h Bartłomiej Borysiuk')).toEqual({ assignment: 'overhead', category: 'vehicle_service' });
    expect(guessSeller('DECATHLON SPÓŁKA')).toBeNull();
    expect(guessSeller(null)).toBeNull();
  });
});

describe('группы по продавцу', () => {
  it('один продавец с разным написанием NIP — одна группа; неразобранные первыми', () => {
    const g = groupBySeller([
      r('a'), r('b', { seller_nip: 'PL5381745394', currency: 'EUR', gross_amount: 10 }),
      r('c', { seller_nip: '5242750440', seller_name: 'LOGISAT', overhead_category: 'software' }),
      r('d', { seller_nip: '5242750440', seller_name: 'LOGISAT', overhead_category: 'software' }),
      r('e', { seller_nip: '5242750440', seller_name: 'LOGISAT', overhead_category: 'software' }),
    ]);
    expect(g.map((x) => x.name)).toEqual(['BIURO RACHUNKOWE MAGDALENA RUSEK', 'LOGISAT']);
    expect(g[0].uncategorized).toBe(2);
    expect(g[0].totals).toEqual([{ currency: 'PLN', amount: 100 }, { currency: 'EUR', amount: 10 }]);
    expect(g[1].category).toBe('software');
    expect(g[1].uncategorized).toBe(0);
  });

  it('ключ без NIP — по названию; категории проверяются', () => {
    expect(sellerKey({ seller_nip: null, seller_name: ' Sklep KAMIL ' })).toBe('name:sklep kamil');
    expect(isOverheadCategory('capex')).toBe(true);
    expect(isOverheadCategory('fuel')).toBe(true);
    expect(isOverheadCategory('diesel')).toBe(false);
  });
});
