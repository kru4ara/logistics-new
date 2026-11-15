import 'server-only';
import { addDaysIso, type InvoiceInput } from '../invoice-rules';
import { buildFakturowoParams, parseReply, parseDocList } from './fakturowo-rules';
import { InvoicingError, type InvoiceProvider, type InvoiceSnapshot } from './types';

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

async function snapshot(apiNumer: string): Promise<InvoiceSnapshot> {
  const lines = await post({ api_zadanie: '3', api_numer: apiNumer });
  const doc = parseDocList(lines, apiNumer);
  if (!doc) throw new InvoicingError(`document ${apiNumer} not found`);
  return {
    number: doc.number,
    // Номер KSeF появляется, когда пользователь отправил фактуру кнопкой в Fakturowo.
    ksef: doc.ksefNumber ? 'ok' : 'pending',
    ksefNumber: doc.ksefNumber,
    ksefError: null,
  };
}

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

  async markPaid(externalId) {
    await post({ api_zadanie: '1', api_numer: externalId, dokument_status: '1' });
  },

  async pdf(externalId) {
    const url = `${base()}/pobierz?${new URLSearchParams({ api_id: apiId(), api_numer: externalId })}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('pdf')) throw new InvoicingError(`PDF: HTTP ${res.status}`, res.status);
    return res.arrayBuffer();
  },
};
