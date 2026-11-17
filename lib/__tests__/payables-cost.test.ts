import { describe, it, expect } from 'vitest';
import { segmentCost, costDiff, costAmount, parseManualInvoice, isCorrectionType } from '../payables/cost-rules';

const plan = { price: 2900, currency: 'EUR', priceEur: 2900 };

describe('стоимость участка: план и факт', () => {
  it('нет счетов — план', () => {
    expect(segmentCost(plan, [])).toEqual({ actual: false, amountEur: 2900, originalAmount: 2900, currency: 'EUR' });
    expect(segmentCost({ price: null, currency: null, priceEur: null }, [])).toBeNull();
  });

  it('основной счёт + доплата + korekta: сумма нетто заменяет план, не добавляется к нему', () => {
    const c = segmentCost(plan, [
      { net: 2900, gross: 2900, currency: 'EUR', netEur: 2900 },
      { net: 150, gross: 150, currency: 'EUR', netEur: 150 }, // простой
      { net: -50, gross: -50, currency: 'EUR', netEur: -50, isCorrection: true }, // korekta
    ]);
    expect(c).toEqual({ actual: true, amountEur: 3000, originalAmount: 3000, currency: 'EUR' });
  });

  it('рейс 18Е: только нулевая korekta (основного счёта нет) — остаётся план, а не 0', () => {
    expect(segmentCost({ price: 2400, currency: 'EUR', priceEur: 2400 }, [{ net: 0, gross: 0, currency: 'EUR', netEur: 0, isCorrection: true }]))
      .toEqual({ actual: false, amountEur: 2400, originalAmount: 2400, currency: 'EUR' });
  });

  it('счёт на 0 без пометки korekta — тоже не факт', () => {
    expect(segmentCost(plan, [{ net: 0, gross: 0, currency: 'EUR', netEur: 0 }])).toMatchObject({ actual: false, amountEur: 2900 });
  });

  it('только korekta с суммой — план плюс разница', () => {
    expect(segmentCost(plan, [{ net: -200, gross: -200, currency: 'EUR', netEur: -200, isCorrection: true }]))
      .toEqual({ actual: true, amountEur: 2700, originalAmount: 2700, currency: 'EUR' });
    expect(segmentCost(plan, [{ net: -1000, gross: -1230, currency: 'PLN', netEur: -235, isCorrection: true }]))
      .toEqual({ actual: true, amountEur: 2665, originalAmount: 2665, currency: 'EUR' });
  });

  it('тип корректирующей фактуры', () => {
    expect(['KOR', 'Kor', 'KOR_ZAL', 'KorRoz'].map(isCorrectionType)).toEqual([true, true, true, true]);
    expect(['VAT', 'ZAL', null, ''].map(isCorrectionType)).toEqual([false, false, false, false]);
  });

  it('польский счёт с НДС: в себестоимость — брутто (полная стоимость)', () => {
    expect(costAmount({ net: 10000, gross: 12300 })).toBe(12300); // брутто — полная стоимость
    expect(costAmount({ net: null, gross: 500 })).toBe(500);
    expect(costAmount({ net: 400, gross: null })).toBe(400);
    const c = segmentCost({ price: 10000, currency: 'PLN', priceEur: 2300 }, [{ net: 10000, gross: 12300, currency: 'PLN', netEur: 2841.3 }]);
    expect(c).toEqual({ actual: true, amountEur: 2841.3, originalAmount: 12300, currency: 'PLN' });
  });

  it('счета в разных валютах — итог в EUR', () => {
    const c = segmentCost(plan, [
      { net: 2900, gross: 2900, currency: 'EUR', netEur: 2900 },
      { net: 400, gross: 492, currency: 'PLN', netEur: 92.4 },
    ]);
    expect(c).toEqual({ actual: true, amountEur: 2992.4, originalAmount: 2992.4, currency: 'EUR' });
  });

  it('расхождение с планом', () => {
    expect(costDiff(2900, 3000)).toEqual({ diff: 100, pct: 3.4, notable: true });
    expect(costDiff(2900, 2910)).toEqual({ diff: 10, pct: 0.3, notable: false });
    expect(costDiff(null, 3000)).toBeNull();
  });
});

describe('ручной счёт подрядчика', () => {
  const f = (o: Record<string, string>) => (k: string) => o[k] ?? null;
  const ok = { invoice_number: ' INV-77 ', issue_date: '2026-11-14', net_amount: '1 250,50', currency: 'eur' };
  it('разбор', () => {
    expect(parseManualInvoice(f(ok))).toEqual({ invoiceNumber: 'INV-77', issueDate: '2026-11-14', net: 1250.5, gross: 1250.5, currency: 'EUR', paymentDue: null });
    expect(parseManualInvoice(f({ ...ok, gross_amount: '1538.12', payment_due: '2026-12-14' }))).toMatchObject({ gross: 1538.12, paymentDue: '2026-12-14' });
    expect(parseManualInvoice(f({ ...ok, net_amount: '-50', gross_amount: '-61.5' }))).toMatchObject({ net: -50, gross: -61.5 });
  });
  it('ошибки', () => {
    expect(parseManualInvoice(f({ ...ok, invoice_number: '' }))).toBe('number');
    expect(parseManualInvoice(f({ ...ok, issue_date: '14.11.2026' }))).toBe('date');
    expect(parseManualInvoice(f({ ...ok, net_amount: '0' }))).toBe('amount');
    expect(parseManualInvoice(f({ ...ok, gross_amount: '100' }))).toBe('amount'); // брутто меньше нетто
    expect(parseManualInvoice(f({ ...ok, currency: 'XYZ' }))).toBe('currency');
    expect(parseManualInvoice(f({ ...ok, payment_due: 'завтра' }))).toBe('due');
  });
});
