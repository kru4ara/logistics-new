import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ddmmyyyy, previousWorkday, fakturowoKind, nipKind, buildFakturowoParams, parseReply, parseDocList,
} from '../invoicing/fakturowo-rules';
import type { InvoiceInput } from '../invoice-rules';

vi.mock('server-only', () => ({}));

const base: InvoiceInput = {
  tripId: 't-1', issueDate: '2026-11-15', sellDate: '2026-11-16', paymentDays: 30, currency: 'EUR',
  netAmount: 1500, tax: 'np', npKind: 'export_service_eu', reverseCharge: true,
  positionName: 'Usługa transportowa: Poznań → Berlin', lang: 'pl/en', note: null,
  buyer: { name: 'Spedition GmbH', taxId: 'DE123456789', street: 'Hauptstr. 1', postCode: '10115', city: 'Berlin', country: 'DE', email: 'a@b.de' },
};

describe('fakturowo-rules', () => {
  it('даты', () => {
    expect(ddmmyyyy('2026-11-05')).toBe('05-11-2026');
    expect(previousWorkday('2026-11-16')).toBe('2026-11-13'); // понедельник → пятница
    expect(previousWorkday('2026-11-18')).toBe('2026-11-17');
  });

  it('тип документа и ставка', () => {
    expect(fakturowoKind({ tax: 'np', npKind: 'export_service_eu' })).toEqual({ rodzaj: '49', stawka: 'npII' });
    expect(fakturowoKind({ tax: 'np', npKind: 'export_service' })).toEqual({ rodzaj: '48', stawka: 'npI' });
    expect(fakturowoKind({ tax: '23', npKind: null })).toEqual({ rodzaj: '0', stawka: '23' });
    // Беларусь и прочие вне ЕС: обычная Faktura VAT со ставкой «np» — как в фактурах компании.
    expect(fakturowoKind({ tax: 'np', npKind: null })).toEqual({ rodzaj: '0', stawka: 'np' });
    expect(nipKind('PL', '5261040828')).toBe('0');
    expect(nipKind('DE', 'DE123')).toBe('2');
    expect(nipKind('UA', '123')).toBe('3');
  });

  it('параметры: ЕС, np II, без пересчёта валюты', () => {
    const p = buildFakturowoParams(base, '2026-12-15', 'PL61109010140000071219812874');
    expect(p).toMatchObject({
      api_zadanie: '1', dokument_rodzaj: '49', produkt_stawka_vat: 'npII', dokument_waluta: '1',
      dokument_data_w: '15-11-2026', dokument_data_s: '16-11-2026', dokument_termin: '15-12-2026',
      dokument_zaplata: '10', nabywca_nip: 'DE123456789', nabywca_nip_oznaczenie: '2', nabywca_kraj: 'DE',
      produkt_cena_netto: '1500.00', produkt_jm: '1', dokument_konto: 'PL61109010140000071219812874',
      nabywca_email: 'a@b.de',
    });
    expect(p.dokument_przelicz_walute).toBeUndefined();
    expect(p.dokument_uwagi).toBeUndefined(); // пометка уже в типе 49
  });

  it('параметры: Польша, 23 % в EUR — пересчёт по NBP с прошлого рабочего дня', () => {
    const p = buildFakturowoParams({ ...base, tax: '23', npKind: null, reverseCharge: false, paymentDays: 21,
      buyer: { ...base.buyer, country: 'PL', taxId: '5261040828' } }, '2026-12-06', null);
    expect(p).toMatchObject({ dokument_rodzaj: '0', produkt_stawka_vat: '23', dokument_zaplata: '0',
      dokument_przelicz_walute: 'PLN', dokument_rodzaj_kursu: '0', dokument_data_wymiany: '13-11-2026',
      nabywca_nip_oznaczenie: '0' });
    expect(p.dokument_konto).toBeUndefined();
  });

  it('параметры: Беларусь, как в FV 80/11/2026', () => {
    const p = buildFakturowoParams({ ...base, npKind: null, reverseCharge: false, paymentDays: 10,
      issueDate: '2026-11-13', sellDate: '2026-11-13',
      positionName: 'Usługa transportowa\nZlecenie klienta: 6877',
      note: 'Dane pojazdu: РВ7970ТН / РВ6190ЕС --- WI042NM / WI652AX',
      buyer: { ...base.buyer, name: 'MSB Logistics, LLC', taxId: 'BY692203928', country: 'BY', email: null } }, '2026-11-23', null);
    expect(p).toMatchObject({ dokument_rodzaj: '0', produkt_stawka_vat: 'np', dokument_waluta: '1',
      dokument_termin: '23-11-2026', nabywca_nip: 'BY692203928', nabywca_kraj: 'BY', nabywca_nip_oznaczenie: '3',
      produkt_nazwa: 'Usługa transportowa\nZlecenie klienta: 6877',
      dokument_uwagi: 'Dane pojazdu: РВ7970ТН / РВ6190ЕС --- WI042NM / WI652AX' });
    expect(p.dokument_przelicz_walute).toBeUndefined();
  });

  it('ответы API', () => {
    expect(parseReply('1\n818950\nhttps://x/pobierz/a\n')).toEqual({ ok: true, lines: ['818950', 'https://x/pobierz/a', ''] });
    expect(parseReply('0\nNieprawidłowy NIP')).toEqual({ ok: false, error: 'Nieprawidłowy NIP' });
    expect(parseReply('<html>')).toEqual({ ok: false, error: '<html>' });
    const row = (ksef: string) =>
      ['818950', '0', 'FV 12/11/2026', '15-11-2026', '16-11-2026', '1', '1500', '0', '1500', 'Seller', 'adr', '111',
        'Buyer', 'adr2', 'DE1', '0', '10', '15-12-2026', ksef].join(';');
    const lines = ['1', row(''), 'Usługa;usł.;1;1500;1500;0;1500;npII;0;1500'];
    expect(parseDocList(lines, '818950')).toMatchObject({ apiNumer: '818950', number: 'FV 12/11/2026', ksefNumber: null, status: '0' });
    expect(parseDocList(['1', row('5261040828-20261116-0A1B2C3D4E5F-01')], '818950')?.ksefNumber)
      .toBe('5261040828-20261116-0A1B2C3D4E5F-01');
    expect(parseDocList(lines, '1')).toBeNull();
  });
});

// ── провайдер на HTTP-заглушке ──
type Hit = { path: string; form: URLSearchParams };
const hits: Hit[] = [];
let ksef = '';
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url!, 'http://x');
      const form = req.method === 'POST' ? new URLSearchParams(body) : url.searchParams;
      hits.push({ path: url.pathname, form });
      if (form.get('api_id') !== 'key') return res.end('0\nNieprawidłowy klucz API');
      if (url.pathname === '/pobierz') {
        res.setHeader('Content-Type', 'application/pdf');
        return res.end('%PDF-1.4');
      }
      const z = form.get('api_zadanie');
      if (z === '1' && !form.get('api_numer')) {
        if (!form.get('nabywca_nip')) return res.end('0\nBrak NIP nabywcy');
        return res.end('1\n818950\nhttps://www.fakturowo.pl/pobierz/abc\nhttps://www.fakturowo.pl/pokaz/abc\nfv.pdf');
      }
      if (z === '1') return res.end('1\n818950');
      if (z === '2') return res.end(form.get('api_numer') === '818950' ? '1' : '0\nBrak dokumentu');
      if (z === '3') {
        const row = ['818950', '49', 'FV 12/11/2026', '15-11-2026', '16-11-2026', '1', '1500', '0', '1500', 'S', 'a', '1',
          'B', 'b', 'DE1', '0', '10', '15-12-2026', ksef].join(';');
        // По одному документу Fakturowo может вернуть только позиции — CRM ищет в общем списке.
        if (form.get('api_numer')) return res.end('1\nUsługa;usł.;1;1500;1500;0;1500;npII;0;1500');
        const paid = row.replace(/;0;10;15-12-2026;/, ';1;10;15-12-2026;');
        return res.end(`1\n1\n${ksef ? paid : row}\nUsługa;usł.;1;1500;1500;0;1500;npII;0;1500`);
      }
      res.end('0\nunknown');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.FAKTUROWO_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  delete process.env.FAKTUROWO_API_URL;
  delete process.env.FAKTUROWO_API_ID;
});
beforeEach(() => {
  process.env.FAKTUROWO_API_ID = 'key';
  ksef = '';
});

describe('fakturowo provider', () => {
  it('выставляет фактуру, читает номер, ждёт ручной отправки в KSeF', async () => {
    const { fakturowo } = await import('../invoicing/fakturowo');
    const r = await fakturowo.issue(base, { bankAccount: null, sendToKsef: true });
    expect(r).toEqual({ externalId: '818950', paymentDue: '2026-12-15', number: 'FV 12/11/2026', ksef: 'pending', ksefNumber: null, ksefError: null });
    const create = hits.find((h) => h.form.get('api_zadanie') === '1')!;
    expect(create.path).toBe('/api');
    expect(create.form.get('dokument_rodzaj')).toBe('49');

    ksef = '5261040828-20261116-0A1B2C3D4E5F-01';
    expect(await fakturowo.refresh('818950')).toMatchObject({ ksef: 'ok', ksefNumber: ksef });
  });

  it('список фактур для сверки', async () => {
    const { fakturowo } = await import('../invoicing/fakturowo');
    ksef = '5261040828-20261116-0A1B2C3D4E5F-01';
    const list = await fakturowo.listInvoices!();
    expect(list).toEqual([expect.objectContaining({
      externalId: '818950', number: 'FV 12/11/2026', payment: 'paid', ksefNumber: ksef, paymentDue: '2026-12-15',
    })]);
  });

  it('оплата, PDF, ошибки', async () => {
    const { fakturowo } = await import('../invoicing/fakturowo');
    await fakturowo.markPaid('818950');
    expect(hits.at(-1)!.form.get('dokument_status')).toBe('1');
    expect(hits.at(-1)!.form.get('api_numer')).toBe('818950');
    expect(Buffer.from(await fakturowo.pdf('818950')).toString()).toBe('%PDF-1.4');
    await fakturowo.cancel('818950');
    expect(hits.at(-1)!.form.get('api_zadanie')).toBe('2');
    await expect(fakturowo.cancel('1')).rejects.toThrow('Brak dokumentu');
    await expect(fakturowo.issue({ ...base, buyer: { ...base.buyer, taxId: null } }, { bankAccount: null, sendToKsef: false }))
      .rejects.toThrow('Brak NIP nabywcy');
    process.env.FAKTUROWO_API_ID = 'bad';
    await expect(fakturowo.refresh('818950')).rejects.toThrow('Nieprawidłowy klucz API');
    await expect(fakturowo.pdf('818950')).rejects.toThrow('PDF');
  });

  it('выбор сервиса фактур', async () => {
    const { getInvoiceProvider, providerById } = await import('../invoicing');
    const env = { ...process.env };
    delete process.env.FAKTUROWNIA_DOMAIN; delete process.env.FAKTUROWNIA_API_TOKEN; delete process.env.INVOICING_PROVIDER;
    expect(getInvoiceProvider()?.id).toBe('fakturowo');
    delete process.env.FAKTUROWO_API_ID;
    expect(getInvoiceProvider()).toBeNull();
    process.env.FAKTUROWNIA_DOMAIN = 'firma'; process.env.FAKTUROWNIA_API_TOKEN = 't';
    expect(getInvoiceProvider()?.id).toBe('fakturownia');
    process.env.INVOICING_PROVIDER = 'fakturowo';
    expect(getInvoiceProvider()).toBeNull(); // выбран явно, но ключа нет
    expect(providerById('fakturowo')?.autoKsef).toBe(false);
    expect(providerById('fakturownia')?.autoKsef).toBe(true);
    expect(providerById('x')).toBeNull();
    process.env = env;
  });
});
