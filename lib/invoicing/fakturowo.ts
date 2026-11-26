import 'server-only';
import { addDaysIso, type InvoiceInput } from '../invoice-rules';
import { buildFakturowoParams, parseReply, parseDocList, parseDocPage, isFakturowoCorrection, type FakturowoDoc } from './fakturowo-rules';
import { InvoicingError, KSEF_LOCKED, type InvoiceProvider, type InvoiceSnapshot, type RemoteInvoice } from './types';

// Fakturowo.pl. Переменная: FAKTUROWO_API_ID — Konto → API (услуга API платная, разовая активация).
// FAKTUROWO_API_URL — только для тестов (заглушка).

const base = () => (process.env.FAKTUROWO_API_URL || 'https://www.fakturowo.pl').replace(/\/$/, '');

function apiId(): string {
  const id = process.env.FAKTUROWO_API_ID;
  if (!id) throw new InvoicingError('FAKTUROWO_API_ID is not set');
  return id;
}

async function post(params: Record<string, string>): Promise<string[]> {
  const res = await fetch(`${base()}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ api_id: apiId(), ...params }).toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new InvoicingError(`HTTP ${res.status}`, res.status);
  const reply = parseReply(text);
  if (!reply.ok) throw new InvoicingError(reply.error);
  return reply.lines;
}

/** Страницы списка документов (по 100). Порядок у Fakturowo не описан — читаем до maxPages. */
async function listDocs(maxPages: number): Promise<FakturowoDoc[]> {
  const out: FakturowoDoc[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const { pages, docs } = parseDocPage(await post({ api_zadanie: '3', p: String(p) }));
    out.push(...docs);
    if (p >= pages || docs.length === 0) break;
  }
  return out;
}

async function findDoc(apiNumer: string): Promise<FakturowoDoc> {
  // Сначала — запрос по одному документу; если строки документа в ответе нет
  // (там могут быть только позиции), ищем его в общем списке.
  const one = parseDocList(await post({ api_zadanie: '3', api_numer: apiNumer }), apiNumer);
  if (one) return one;
  const all = await listDocs(20);
  const doc = all.find((d) => d.apiNumer === apiNumer);
  if (!doc) throw new InvoicingError(`document ${apiNumer} not found`);
  return doc;
}

async function snapshot(apiNumer: string): Promise<InvoiceSnapshot> {
  const doc = await findDoc(apiNumer);
  return {
    number: doc.number,
    // Номер KSeF появляется, когда пользователь отправил фактуру кнопкой в Fakturowo.
    ksef: doc.ksefNumber ? 'ok' : 'pending',
    ksefNumber: doc.ksefNumber,
    ksefError: null,
  };
}

const toRemote = (d: FakturowoDoc): RemoteInvoice => ({
  externalId: d.apiNumer,
  kind: isFakturowoCorrection(d.kind) ? 'correction' : 'invoice',
  number: d.number,
  issueDate: d.issueDate,
  paymentDue: d.paymentDue,
  payment: d.status === '1' ? 'paid' : d.status === '2' ? 'partial' : 'unpaid',
  ksefNumber: d.ksefNumber,
  gross: d.gross,
  currency: d.currency,
  buyerName: d.buyerName,
  buyerTaxId: d.buyerTaxId,
});

export const fakturowo: InvoiceProvider = {
  id: 'fakturowo',
  name: 'Fakturowo.pl',
  autoKsef: false,
  appUrl: 'https://www.fakturowo.pl/dokumenty',

  async issue(input: InvoiceInput, { bankAccount }) {
    const paymentDue = addDaysIso(input.issueDate, input.paymentDays);
    const lines = await post(buildFakturowoParams(input, paymentDue, bankAccount));
    const externalId = lines[0];
    if (!externalId) throw new InvoicingError('empty api_numer');
    // Номер документа в ответе на сохранение не приходит — читаем из списка.
    const snap = await snapshot(externalId).catch(() => null);
    return {
      externalId,
      paymentDue,
      number: snap?.number ?? null,
      ksef: 'pending',
      ksefNumber: snap?.ksefNumber ?? null,
      ksefError: null,
    };
  },

  refresh: snapshot,

  async listInvoices(opts) {
    return (await listDocs(opts?.maxPages ?? 50)).map(toRemote);
  },

  async markPaid(externalId) {
    try {
      await post({ api_zadanie: '1', api_numer: externalId, dokument_status: '1' });
    } catch (e) {
      // «faktura została już przesłana do systemu ksef … nie można jej edytować»:
      // у Fakturowo нет вызова API только для оплаты — её отмечают в списке документов.
      if (e instanceof InvoicingError && /ksef/i.test(e.message) && /edytowa/i.test(e.message)) {
        throw new InvoicingError(KSEF_LOCKED, 409);
      }
      throw e;
    }
  },

  async cancel(externalId) {
    await post({ api_zadanie: '2', api_numer: externalId });
  },

  async pdf(externalId) {
    const url = `${base()}/pobierz?${new URLSearchParams({ api_id: apiId(), api_numer: externalId })}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('pdf')) throw new InvoicingError(`PDF: HTTP ${res.status}`, res.status);
    return res.arrayBuffer();
  },
};
