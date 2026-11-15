import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateDecrypt, constants } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { parseFa3, pickTokenCert, authStatus, dateWindows, ksefEnv } from '../ksef/rules';

vi.mock('server-only', () => ({}));

// FA(3) подрядчика: перевозка по нашей заявке 6877-1, np, EUR.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek><KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza><WariantFormularza>3</WariantFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><NIP>5261040828</NIP><Nazwa>Trans-Kowalski Sp. z o.o.</Nazwa></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><NIP>7011162939</NIP><Nazwa>Raibuilding SP. Z O.O.</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>EUR</KodWaluty>
    <P_1>2026-11-14</P_1>
    <P_2>FV 15/11/2026</P_2>
    <P_13_8>2900.00</P_13_8>
    <P_15>2900.00</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
    <DodatkowyOpis><Klucz>Zlecenie</Klucz><Wartosc>6877-1</Wartosc></DodatkowyOpis>
    <FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Usługa transportowa Trud – Brest, zlecenie 6877-1</P_7><P_11>2900.00</P_11><P_12>np I</P_12></FaWiersz>
    <Platnosc>
      <TerminPlatnosci><Termin>2026-12-14</Termin></TerminPlatnosci>
      <FormaPlatnosci>6</FormaPlatnosci>
      <RachunekBankowy><NrRB>PL61109010140000071219812874</NrRB></RachunekBankowy>
    </Platnosc>
  </Fa>
</Faktura>`;

describe('ksef rules', () => {
  it('разбирает FA(3)', () => {
    expect(parseFa3(XML)).toEqual({
      invoiceNumber: 'FV 15/11/2026', issueDate: '2026-11-14', sellerNip: '5261040828', sellerName: 'Trans-Kowalski Sp. z o.o.',
      currency: 'EUR', net: 2900, vat: null, gross: 2900, paymentDue: '2026-12-14', bankAccount: 'PL61109010140000071219812874',
      description: 'Usługa transportowa Trud – Brest, zlecenie 6877-1\nZlecenie: 6877-1', invoiceType: 'VAT',
    });
  });

  it('FA(3) с префиксом пространства имён и НДС', () => {
    const x = XML.replace(/<(\/?)([A-Za-z_0-9]+)/g, '<$1tns:$2').replace('<tns:Faktura xmlns=', '<tns:Faktura xmlns:tns=')
      .replace('<tns:P_13_8>2900.00</tns:P_13_8>', '<tns:P_13_1>1000.00</tns:P_13_1><tns:P_14_1>230.00</tns:P_14_1>')
      .replace('<tns:P_15>2900.00</tns:P_15>', '<tns:P_15>1230.00</tns:P_15>');
    expect(parseFa3(x)).toMatchObject({ net: 1000, vat: 230, gross: 1230, sellerNip: '5261040828' });
  });

  it('выбор сертификата, статусы, окна, окружение', () => {
    const now = new Date('2026-11-15T00:00:00Z');
    const c = (usage: string[], from: string, to: string) => ({ certificate: 'x', validFrom: from, validTo: to, usage });
    expect(pickTokenCert([
      c(['SymmetricKeyEncryption'], '2026-01-01', '2027-01-01'),
      c(['KsefTokenEncryption'], '2025-01-01', '2026-01-01'),
      c(['KsefTokenEncryption'], '2026-02-01', '2027-02-01'),
    ], now)?.validFrom).toBe('2026-02-01');
    expect(pickTokenCert([c(['KsefTokenEncryption'], '2027-01-01', '2028-01-01')], now)).toBeNull();
    expect([authStatus(100), authStatus(200), authStatus(450), authStatus(undefined)]).toEqual(['pending', 'ok', 'error', 'error']);
    const w = dateWindows('2026-01-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z');
    expect(w).toHaveLength(3);
    expect(w[0]).toEqual({ from: '2026-01-01T00:00:00.000Z', to: '2026-04-01T00:00:00.000Z' });
    expect(w.at(-1)!.to).toBe('2026-07-01T00:00:00.000Z');
    expect([ksefEnv(undefined), ksefEnv('demo'), ksefEnv('x')]).toEqual(['prod', 'demo', 'prod']);
  });
});

// ── клиент на заглушке KSeF: вход по токену и загрузка ──
let server: http.Server;
let privKey = '';
let certB64 = '';
const seen: { method: string; url: string; auth?: string; body: string }[] = [];
let statusPolls = 0;
const KSEF_NO = '5261040828-20261114-0A1B2C3D4E5F-01';

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ksef-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'),
    '-days', '2', '-subj', '/CN=ksef-test-stub'], { stdio: 'ignore' });
  privKey = readFileSync(join(dir, 'k.pem'), 'utf8');
  certB64 = readFileSync(join(dir, 'c.pem'), 'utf8').replace(/-----[^-]+-----|\s/g, '');

  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body });
      const json = (o: unknown, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      const u = req.url!;
      if (u === '/v2/auth/challenge') return json({ challenge: 'CH-1', timestamp: '2026-11-15T10:00:00Z', timestampMs: 1763200800000, clientIp: '1.1.1.1' });
      if (u === '/v2/security/public-key-certificates') {
        return json([{ certificate: certB64, certificateId: 'a', publicKeyId: 'b', validFrom: '2020-01-01T00:00:00Z', validTo: '2099-01-01T00:00:00Z', usage: ['KsefTokenEncryption'] }]);
      }
      if (u === '/v2/auth/ksef-token') {
        const b = JSON.parse(body);
        const plain = privateDecrypt({ key: privKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(b.encryptedToken, 'base64')).toString();
        if (plain !== 'TOKEN-ABC|1763200800000' || b.challenge !== 'CH-1' || b.contextIdentifier?.type !== 'Nip' || b.contextIdentifier?.value !== '7011162939') {
          return json({ exception: { exceptionDetailList: [{ exceptionCode: 21405, exceptionDescription: 'bad token' }] } }, 400);
        }
        return json({ referenceNumber: 'REF-1', authenticationToken: { token: 'AUTH-JWT', validUntil: '2099-01-01T00:00:00Z' } }, 202);
      }
      if (u === '/v2/auth/REF-1') {
        if (req.headers.authorization !== 'Bearer AUTH-JWT') return json({}, 401);
        statusPolls++;
        return json({ status: statusPolls < 2 ? { code: 100, description: 'Uwierzytelnianie w toku' } : { code: 200, description: 'OK' } });
      }
      if (u === '/v2/auth/token/redeem') {
        return json({ accessToken: { token: 'ACCESS-JWT', validUntil: '2099-01-01T00:00:00Z' }, refreshToken: { token: 'R', validUntil: '2099-01-01T00:00:00Z' } });
      }
      if (u.startsWith('/v2/invoices/query/metadata')) {
        if (req.headers.authorization !== 'Bearer ACCESS-JWT') return json({}, 401);
        const page = Number(new URL(u, 'http://x').searchParams.get('pageOffset'));
        const inv = (n: number) => ({ ksefNumber: `${KSEF_NO}-${n}`, invoiceNumber: `FV ${n}`, issueDate: '2026-11-14', permanentStorageDate: `2026-11-14T10:0${n}:00Z`,
          seller: { nip: '5261040828', name: 'Trans' }, netAmount: 1, vatAmount: 0, grossAmount: 1, currency: 'EUR', invoiceType: 'Vat' });
        return json(page === 0
          ? { hasMore: true, isTruncated: false, invoices: [inv(1)], permanentStorageHwmDate: '2026-11-15T09:00:00Z' }
          : { hasMore: false, isTruncated: false, invoices: [inv(2)], permanentStorageHwmDate: '2026-11-15T09:00:00Z' });
      }
      if (u === `/v2/invoices/ksef/${KSEF_NO}`) { res.setHeader('Content-Type', 'application/xml'); return res.end(XML); }
      json({}, 404);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.KSEF_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v2`;
  process.env.KSEF_TOKEN = 'TOKEN-ABC';
  process.env.KSEF_NIP = '7011162939';
});
afterAll(() => {
  server.close();
  for (const k of ['KSEF_API_URL', 'KSEF_TOKEN', 'KSEF_NIP']) delete process.env[k];
});

describe('ksef client', () => {
  it('входит по токену (RSA-OAEP SHA-256), ждёт статус 200, получает accessToken', async () => {
    const m = await import('../ksef/client');
    m.resetKsefToken();
    expect(m.isKsefConfigured()).toBe(true);
    expect(await m.accessToken()).toBe('ACCESS-JWT');
    expect(statusPolls).toBe(2);
    expect(await m.accessToken()).toBe('ACCESS-JWT'); // из кеша
    expect(seen.filter((s) => s.url === '/v2/auth/challenge')).toHaveLength(1);
  });

  it('метаданные Subject2 по страницам, с HWM; XML фактуры', async () => {
    const m = await import('../ksef/client');
    const r = await m.queryPurchaseMetadata('2026-10-01T00:00:00.000Z');
    expect(r.invoices.map((i) => i.invoiceNumber)).toEqual(['FV 1', 'FV 2']);
    expect(r.hwm).toBe('2026-11-15T09:00:00Z');
    const q = JSON.parse(seen.find((s) => s.url.startsWith('/v2/invoices/query/metadata'))!.body);
    expect(q).toEqual({ subjectType: 'Subject2', dateRange: { dateType: 'PermanentStorage', from: '2026-10-01T00:00:00.000Z', restrictToPermanentStorageHwmDate: true } });
    expect(await m.downloadInvoiceXml(KSEF_NO)).toContain('<P_2>FV 15/11/2026</P_2>');
  });

  it('понятная ошибка при неверном токене', async () => {
    const m = await import('../ksef/client');
    m.resetKsefToken();
    process.env.KSEF_TOKEN = 'WRONG';
    await expect(m.accessToken()).rejects.toThrow('21405: bad token');
    process.env.KSEF_TOKEN = 'TOKEN-ABC';
  });
});
