import { describe, it, expect } from 'vitest';
import { findManualDuplicates, type CostForDup, type InvoiceAmounts } from '../fixed-costs-dup-rules';

const c = (id: string, o: Partial<CostForDup> = {}): CostForDup => ({
  id, month_key: '2026-10', expense_date: '2026-10-05', category: 'Бухгалтерия', currency: 'PLN', original_amount: 1476, purchase_invoice_id: null, ...o,
});
const inv = (o: Partial<InvoiceAmounts> = {}): InvoiceAmounts => ({ gross: 1476, net: 1200, number: 'FA/1819/2026', issueDate: '2026-10-05', ...o });

describe('ручная запись = счёт из KSeF', () => {
  it('сумма + валюта + дата рядом', () => {
    const pairs = findManualDuplicates([c('m'), c('k', { purchase_invoice_id: 'i1' })], new Map([['i1', inv()]]));
    expect(pairs).toEqual([{ manualId: 'm', invoiceCostId: 'k', byNumber: false }]);
  });

  it('номер счёта в тексте — даже если дата далеко (LOGISAT FI/65/2026/10)', () => {
    const pairs = findManualDuplicates(
      [c('m', { category: 'LOGISAT KALINOWSKI BRUDEK FAKTURA VAT NR FI/65/2026/10', original_amount: 481.7, expense_date: '2026-11-20', month_key: '2026-11' }),
       c('k', { purchase_invoice_id: 'i1', original_amount: 481.7 })],
      new Map([['i1', inv({ gross: 481.7, net: 391.63, number: 'FI/65/2026/10', issueDate: '2026-10-02' })]]),
    );
    expect(pairs).toEqual([{ manualId: 'm', invoiceCostId: 'k', byNumber: true }]);
  });

  it('другая валюта, сумма или далёкая дата — не дубль; одна пара на запись', () => {
    const invs = new Map([['i1', inv()]]);
    expect(findManualDuplicates([c('m', { currency: 'EUR' }), c('k', { purchase_invoice_id: 'i1' })], invs)).toEqual([]);
    expect(findManualDuplicates([c('m', { original_amount: 1500 }), c('k', { purchase_invoice_id: 'i1' })], invs)).toEqual([]);
    expect(findManualDuplicates([c('m', { expense_date: '2026-12-20' }), c('k', { purchase_invoice_id: 'i1' })], invs)).toEqual([]);
    // две ручные одинаковые — с одним счётом сходится только первая
    expect(findManualDuplicates([c('m1'), c('m2'), c('k', { purchase_invoice_id: 'i1' })], invs).map((p) => p.manualId)).toEqual(['m1']);
    // ручная без даты — тот же месяц
    expect(findManualDuplicates([c('m', { expense_date: null }), c('k', { purchase_invoice_id: 'i1' })], invs)).toHaveLength(1);
  });
});
