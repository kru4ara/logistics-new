import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('server-only', () => ({}));

type Req = { method: string; url: string; auth: string | undefined; body: string };
const seen: Req[] = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body });
      res.setHeader('Content-Type', 'application/json');
      if (req.url!.startsWith('/invoices.json') && req.method === 'POST') {
        const inv = JSON.parse(body).invoice;
        if (!inv.buyer_tax_no) {
          res.statusCode = 422;
          return res.end(JSON.stringify({ code: 'error', message: { buyer_tax_no: ['nie może być puste'] } }));
        }
        return res.end(JSON.stringify({ id: 42, number: 'FV 1/11/2026', payment_to: inv.payment_to, gov_status: 'processing' }));
      }
      if (req.url === '/invoices/42.json' && req.method === 'GET') {
        return res.end(JSON.stringify({ id: 42, number: 'FV 1/11/2026', gov_status: 'ok', gov_id: '5261040828-20261115-ABC' }));
      }
      if (req.url === '/invoices/42.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        return res.end('%PDF-1.4');
      }
      if (req.url!.startsWith('/invoices/42/change_status.json')) return res.end('{}');
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.FAKTUROWNIA_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.FAKTUROWNIA_API_TOKEN = 'tok';
  process.env.FAKTUROWNIA_DOMAIN = 'firma';
});
afterAll(() => {
  server.close();
  delete process.env.FAKTUROWNIA_API_URL;
  delete process.env.FAKTUROWNIA_API_TOKEN;
  delete process.env.FAKTUROWNIA_DOMAIN;
});

describe('fakturownia client', () => {
  it('проверяет домен', async () => {
    const m = await import('../fakturownia');
    process.env.FAKTUROWNIA_DOMAIN = 'https://firma.fakturownia.pl/';
    expect(m.fakturowniaDomain()).toBe('firma');
    process.env.FAKTUROWNIA_DOMAIN = 'evil.com/x';
    expect(m.fakturowniaDomain()).toBeNull();
    expect(m.isFakturowniaConfigured()).toBe(false);
    process.env.FAKTUROWNIA_DOMAIN = 'firma';
    expect(m.isFakturowniaConfigured()).toBe(true);
  });

  it('создаёт фактуру с отправкой в KSeF, читает статус, PDF, оплату', async () => {
    const m = await import('../fakturownia');
    const inv = await m.createInvoice({ invoice: { buyer_tax_no: '1', payment_to: '2026-12-15' } }, true);
    expect(inv).toMatchObject({ id: 42, number: 'FV 1/11/2026', gov_status: 'processing' });
    expect(seen.at(-1)).toMatchObject({ method: 'POST', url: '/invoices.json?gov_save_and_send=1', auth: 'Bearer tok' });

    expect((await m.getInvoice(42)).gov_id).toBe('5261040828-20261115-ABC');
    expect(Buffer.from(await m.getInvoicePdf(42)).toString()).toBe('%PDF-1.4');
    await m.markPaid(42);
    expect(seen.at(-1)).toMatchObject({ method: 'POST', url: '/invoices/42/change_status.json?status=paid' });
  });

  it('передаёт текст ошибки Fakturownia', async () => {
    const m = await import('../fakturownia');
    await expect(m.createInvoice({ invoice: {} }, false)).rejects.toThrow('buyer_tax_no: nie może być puste');
    expect(seen.at(-1)!.url).toBe('/invoices.json');
  });
});
