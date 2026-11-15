import { describe, it, expect } from 'vitest';
import {
  normalizeCountry, normalizeTaxId, isValidNip, suggestVat, validateInvoice,
  buildInvoicePayload, fakturowniaKsefState, govErrors, positionName, addDaysIso, taxNoKind,
  type InvoiceInput,
} from '../invoice-rules';

const base: InvoiceInput = {
  tripId: 't-1',
  issueDate: '2026-11-15',
  sellDate: '2026-11-12',
  paymentDays: 30,
  currency: 'EUR',
  netAmount: 1500,
  tax: 'np',
  npKind: 'export_service_eu',
  reverseCharge: true,
  positionName: 'Usługa transportowa: Poznań, PL → Berlin, DE',
  lang: 'pl/en',
  note: null,
  buyer: { name: 'Spedition GmbH', taxId: 'DE123456789', street: 'Hauptstr. 1', postCode: '10115', city: 'Berlin', country: 'DE', email: null },
};

describe('invoice-rules', () => {
  it('нормализует страну и номер', () => {
    expect(normalizeCountry(' de ')).toBe('DE');
    expect(normalizeCountry('Germany')).toBeNull();
    expect(normalizeTaxId('PL 526-104-08-28', 'PL')).toBe('5261040828');
    expect(normalizeTaxId('123456789', 'DE')).toBe('DE123456789');
    expect(normalizeTaxId('123456789', 'GR')).toBe('EL123456789');
    expect(normalizeTaxId('', 'DE')).toBeNull();
  });

  it('проверяет NIP', () => {
    expect(isValidNip('5261040828')).toBe(true);
    expect(isValidNip('5261040829')).toBe(false);
    expect(isValidNip('12345')).toBe(false);
  });

  it('предлагает НДС по стране', () => {
    expect(suggestVat('PL')).toEqual({ tax: '23', npKind: null, reverseCharge: false });
    expect(suggestVat(null).tax).toBe('23');
    expect(suggestVat('DE')).toEqual({ tax: 'np', npKind: 'export_service_eu', reverseCharge: true });
    expect(suggestVat('UA')).toEqual({ tax: 'np', npKind: 'export_service', reverseCharge: false });
  });

  it('валидирует ввод', () => {
    expect(validateInvoice(base)).toBeNull();
    expect(validateInvoice({ ...base, buyer: { ...base.buyer, taxId: null } })).toBe('buyerTaxId');
    expect(validateInvoice({ ...base, buyer: { ...base.buyer, country: 'PL', taxId: '1234567890' } })).toBe('buyerNip');
    expect(validateInvoice({ ...base, buyer: { ...base.buyer, city: null } })).toBe('buyerAddress');
    expect(validateInvoice({ ...base, netAmount: 0 })).toBe('amount');
    expect(validateInvoice({ ...base, issueDate: '15.11.2026' })).toBe('dates');
    expect(validateInvoice({ ...base, positionName: ' ' })).toBe('positionName');
  });

  it('собирает JSON для Fakturownia', () => {
    const { invoice } = buildInvoicePayload(base, 'PL61 1090 1014 0000 0712 1981 2874') as { invoice: any };
    expect(invoice.payment_to).toBe('2026-12-15');
    expect(invoice.oid).toBe('t-1');
    expect(invoice.oid_unique).toBe('yes');
    expect(invoice.buyer_tax_no_kind).toBe('nip_ue');
    expect(invoice.exchange_kind).toBe('nbp');
    expect(invoice.np_tax_kind).toBe('export_service_eu');
    expect(invoice.reverse_charge).toBe(true);
    expect(invoice.description).toBe('Odwrotne obciążenie');
    expect(invoice.positions[0]).toMatchObject({ tax: 'np', price_net: 1500, quantity: 1 });

    const pl = buildInvoicePayload({ ...base, currency: 'PLN', tax: '23', npKind: null, reverseCharge: false,
      buyer: { ...base.buyer, country: 'PL', taxId: '5261040828' } }, null) as { invoice: any };
    expect(pl.invoice.positions[0].tax).toBe(23);
    expect(pl.invoice.exchange_kind).toBeUndefined();
    expect(pl.invoice.np_tax_kind).toBeUndefined();
    expect(pl.invoice.buyer_tax_no_kind).toBe('');
    expect(pl.invoice.description).toBeUndefined();
  });

  it('понимает gov_status', () => {
    expect(fakturowniaKsefState(null)).toBe('none');
    expect(fakturowniaKsefState('ok')).toBe('ok');
    expect(fakturowniaKsefState('demo_ok')).toBe('ok');
    expect(fakturowniaKsefState('offline')).toBe('processing');
    expect(fakturowniaKsefState('send_error')).toBe('error');
    expect(fakturowniaKsefState('not_connected')).toBe('notConnected');
    expect(govErrors(['a', 'b'])).toBe('a; b');
    expect(govErrors(null)).toBeNull();
  });

  it('прочее', () => {
    expect(addDaysIso('2026-12-20', 14)).toBe('2027-01-03');
    expect(taxNoKind('UA', '12345')).toBe('other');
    expect(positionName('A → B', null, '77')).toBe('Usługa transportowa: A → B. Zlecenie nr 77');
    expect(positionName(null, 'Z-1', '77')).toBe('Usługa transportowa. Zlecenie nr Z-1');
  });
});

import { parseClientRequisites } from '../invoice-rules';
describe('parseClientRequisites', () => {
  const f = (o: Record<string, string>) => (k: string) => o[k] ?? null;
  it('разбирает и нормализует', () => {
    expect(parseClientRequisites(f({ tax_id: 'PL 526 104 08 28', country: 'pl', city: ' Poznań ' }))).toEqual({
      tax_id: '5261040828', street: null, post_code: null, city: 'Poznań', country: 'PL',
    });
    expect(parseClientRequisites(f({ country: 'Polska' }))).toBe('badCountry');
    expect(parseClientRequisites(f({}))).toEqual({ tax_id: null, street: null, post_code: null, city: null, country: null });
  });
});
