import { describe, it, expect } from 'vitest';
import { planInvoiceSync, normalizeInvoiceNumber, type SyncTrip } from '../invoicing/sync-rules';
import { parseDocRow, parseDocPage, isoFromDdMmYyyy } from '../invoicing/fakturowo-rules';
import type { RemoteInvoice } from '../invoicing/types';

const KSEF = '7011162939-20261114-52D8B6C00001-C4';
const row = (o: Partial<Record<'id' | 'num' | 'status' | 'termin' | 'ksef' | 'addr', string>> = {}) =>
  [o.id ?? '818950', '0', o.num ?? '80/11/2026', '13-11-2026', '13-11-2026', 'EUR', '3800,00', '0,00', '3800,00',
    'Raibuilding SP. Z O.O.', 'Parkowa 12, 21-345 Wola Osowińska', 'PL7011162939',
    'MSB Logistics, LLC', o.addr ?? 'Logojskajaya 5A / 205, 223053 D. Valerjanovo', 'BY692203928',
    o.status ?? '0', '7', o.termin ?? '23-11-2026', o.ksef ?? ''].join(';');

describe('разбор списка Fakturowo', () => {
  it('строка документа', () => {
    expect(isoFromDdMmYyyy('23-11-2026')).toBe('2026-11-23');
    expect(parseDocRow(row({ ksef: KSEF, status: '1' }))).toEqual({
      apiNumer: '818950', kind: '0', number: '80/11/2026', issueDate: '2026-11-13', currency: 'EUR', gross: 3800,
      buyerName: 'MSB Logistics, LLC', buyerTaxId: 'BY692203928', status: '1', paymentDue: '2026-11-23', ksefNumber: KSEF,
    });
  });
  it('«;» в адресе не сдвигает конец строки', () => {
    const d = parseDocRow(row({ addr: 'ul. A; lok. 5', ksef: KSEF }))!;
    expect(d.ksefNumber).toBe(KSEF);
    expect(d.paymentDue).toBe('2026-11-23');
    expect(d.buyerTaxId).toBe('BY692203928');
  });
  it('строки позиций и мусор — не документы', () => {
    expect(parseDocRow('Usługa transportowa;szt.;1;3800;3800;0;3800;np;0;3800')).toBeNull();
    expect(parseDocPage(['2', row(), 'Usługa;szt.;1;1;1;0;1;np;0;1', row({ id: '9', num: '81/11/2026' })]))
      .toMatchObject({ pages: 2, docs: [{ apiNumer: '818950' }, { apiNumer: '9' }] });
  });
});

const remote = (o: Partial<RemoteInvoice> = {}): RemoteInvoice => ({
  externalId: '818950', number: '80/11/2026', issueDate: '2026-11-13', paymentDue: '2026-11-23', payment: 'unpaid',
  ksefNumber: null, gross: 3800, currency: 'EUR', buyerName: 'MSB', buyerTaxId: 'BY1', ...o,
});
const trip = (o: Partial<SyncTrip> = {}): SyncTrip => ({
  id: 't1', status: 'invoiced', invoice_provider: 'fakturowo', invoice_external_id: '818950', invoice_number: '80/11/2026',
  invoiced_at: '2026-11-13', payment_due: '2026-11-23', ksef_number: null, ksef_status: 'pending', ...o,
});

describe('сверка дебиторки', () => {
  it('нормализует номер', () => {
    expect(normalizeInvoiceNumber('FV 80/11/2026')).toBe('80/11/2026');
    expect(normalizeInvoiceNumber('Faktura VAT 80/11/2026')).toBe('80/11/2026');
    expect(normalizeInvoiceNumber(' 80 / 11 / 2026 ')).toBe('80/11/2026');
    expect(normalizeInvoiceNumber('')).toBeNull();
  });

  it('номер KSeF и оплата по связанной фактуре', () => {
    const { updates } = planInvoiceSync('fakturowo', [remote({ ksefNumber: KSEF, payment: 'paid' })], [trip()]);
    expect(updates).toEqual([{
      tripId: 't1', number: '80/11/2026',
      patch: { ksef_number: KSEF, ksef_status: 'ok', ksef_error: null, status: 'paid' },
      changes: ['ksef', 'paid'],
    }]);
  });

  it('ничего не изменилось — нет обновлений', () => {
    expect(planInvoiceSync('fakturowo', [remote()], [trip()]).updates).toEqual([]);
  });

  it('фактура из Fakturowo без связи — по номеру, заказ становится «счёт выставлен»', () => {
    const t = trip({ status: 'completed', invoice_provider: null, invoice_external_id: null, invoice_number: 'FV 80/11/2026', invoiced_at: null, payment_due: null, ksef_status: null });
    const { updates } = planInvoiceSync('fakturowo', [remote()], [t]);
    expect(updates[0].patch).toEqual({
      invoice_provider: 'fakturowo', invoice_external_id: '818950', invoice_number: '80/11/2026',
      ksef_status: 'pending', payment_due: '2026-11-23', status: 'invoiced', invoiced_at: '2026-11-13',
    });
    expect(updates[0].changes).toEqual(['linked', 'due', 'invoiced']);
  });

  it('не связывает при неоднозначности и не откатывает оплату', () => {
    const a = trip({ id: 'a', invoice_provider: null, invoice_external_id: null });
    const b = trip({ id: 'b', invoice_provider: null, invoice_external_id: null });
    const r = planInvoiceSync('fakturowo', [remote()], [a, b]);
    expect(r.updates).toEqual([]);
    expect(r.unpaidUnmatched).toHaveLength(1);
    // два документа с одним номером в сервисе
    expect(planInvoiceSync('fakturowo', [remote(), remote({ externalId: '2' })], [a]).updates).toEqual([]);
    // CRM: оплачен, сервис: не оплачен — оставляем «оплачен»
    expect(planInvoiceSync('fakturowo', [remote()], [trip({ status: 'paid' })]).updates).toEqual([]);
  });

  it('фактура другого сервиса не сопоставляется по id', () => {
    const r = planInvoiceSync('fakturowo', [remote()], [trip({ invoice_provider: 'fakturownia' })]);
    expect(r.updates).toEqual([]);
  });
});
