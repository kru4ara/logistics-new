import { describe, it, expect } from 'vitest';
import { planInvoiceSync, normalizeInvoiceNumber, type SyncTrip } from '../invoicing/sync-rules';
import { parseDocRow, parseDocPage, isoFromDdMmYyyy, daysFromZaplata, paymentCode } from '../invoicing/fakturowo-rules';
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
  it('даты и срок: разные форматы; пустой termin — из способа оплаты', () => {
    expect(isoFromDdMmYyyy('2026-11-23')).toBe('2026-11-23');
    expect(isoFromDdMmYyyy('23.11.2026')).toBe('2026-11-23');
    expect(isoFromDdMmYyyy('')).toBeNull();
    expect(daysFromZaplata('przelew w terminie 10 dni')).toBe(10);
    expect(daysFromZaplata('10')).toBe(30);
    expect(daysFromZaplata('gotówka')).toBeNull();
    const r = row({ termin: '' }).replace(';0;7;;', ';0;przelew w terminie 10 dni;;');
    expect(parseDocRow(r)!.paymentDue).toBe('2026-11-23');
    expect(parseDocRow(row({ termin: '' }))!.paymentDue).toBeNull(); // код 7 — неизвестен
  });

  it('строка с «;» в конце (как отдаёт Fakturowo): оплата, срок и KSeF не съезжают', () => {
    const d = parseDocRow(row({ status: '1', ksef: KSEF }) + ';')!;
    expect(d).toMatchObject({ status: '1', paymentDue: '2026-11-23', ksefNumber: KSEF, buyerTaxId: 'BY692203928' });
    const empty = parseDocRow(row({ status: '1', ksef: '' }) + ';')!;
    expect(empty).toMatchObject({ status: '1', paymentDue: '2026-11-23', ksefNumber: null });
    // «;» в адресе и в конце сразу
    expect(parseDocRow(row({ addr: 'ul. A; lok. 5', status: '1', ksef: KSEF }) + ';')).toMatchObject({ status: '1', paymentDue: '2026-11-23', ksefNumber: KSEF });
  });

  it('статус оплаты — код или текст', () => {
    expect(['1', 'zapłacona', 'Opłacona', '2', 'częściowo zapłacona', '0', 'niezapłacona', '', 'xyz'].map(paymentCode))
      .toEqual(['1', '1', '1', '2', '2', '0', '0', '0', '0']);
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

  it('номер вписан вручную и уже связан, даты в CRM нет — берём дату счёта из сервиса', () => {
    const { updates } = planInvoiceSync('fakturowo', [remote({ payment: 'paid' })], [trip({ status: 'paid', invoiced_at: null })]);
    expect(updates[0].patch).toEqual({ invoiced_at: '2026-11-13' });
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

import { patchFromRemote, visibleUnmatched, rankTripsForInvoice } from '../invoicing/sync-rules';

describe('фактуры без заказа', () => {
  it('ручная привязка: связь, номер, даты, KSeF, оплата', () => {
    const t = trip({ status: 'completed', invoice_provider: null, invoice_external_id: null, invoice_number: '6822', invoiced_at: null, payment_due: null, ksef_status: null });
    const { patch } = patchFromRemote('fakturowo', remote({ ksefNumber: KSEF, payment: 'paid' }), t, true);
    expect(patch).toEqual({
      invoice_provider: 'fakturowo', invoice_external_id: '818950', invoice_number: '80/11/2026',
      ksef_number: KSEF, ksef_status: 'ok', ksef_error: null, payment_due: '2026-11-23', invoiced_at: '2026-11-13', status: 'paid',
    });
  });

  it('скрытые «не к заказу» не показываются', () => {
    expect(visibleUnmatched([remote(), remote({ externalId: '2' })], ['818950']).map((r) => r.externalId)).toEqual(['2']);
  });

  it('подсказки: тот же покупатель и сумма — выше', () => {
    const ranked = rankTripsForInvoice(remote({ buyerTaxId: 'BY692203928', gross: 3800 }), [
      { id: 'a', trip_number: '1', client_tax_id: 'PL5261040828', revenue_eur: 3800, date: '2026-11-12' },
      { id: 'b', trip_number: '2', client_tax_id: 'BY692203928', revenue_eur: 3800, date: '2026-11-10' },
      { id: 'c', trip_number: '3', client_tax_id: 'BY692203928', revenue_eur: 1000, date: '2026-06-01' },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(ranked[0].score).toBeGreaterThanOrEqual(80);
  });
});
