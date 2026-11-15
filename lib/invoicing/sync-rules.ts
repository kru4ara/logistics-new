// Сверка дебиторки с сервисом фактур — чистые правила (покрыты тестами).
// Сервис фактур — источник правды для оплаты, срока и номера KSeF; CRM их не придумывает.
import type { ProviderId, RemoteInvoice } from './types';

export type SyncTrip = {
  id: string;
  status: string | null;
  invoice_provider: string | null;
  invoice_external_id: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
  payment_due: string | null;
  ksef_number: string | null;
  ksef_status: string | null;
};

export type TripPatch = Record<string, string | null>;

export type SyncUpdate = {
  tripId: string;
  number: string | null;
  patch: TripPatch;
  /** что изменилось — коды для журнала и отчёта */
  changes: ('linked' | 'number' | 'ksef' | 'due' | 'invoiced' | 'paid')[];
};

/** «FV 80/11/2026», «Faktura VAT 80/11/2026», « 80/11/2026 » → «80/11/2026». */
export function normalizeInvoiceNumber(v: string | null | undefined): string | null {
  const s = (v ?? '')
    .toUpperCase()
    .replace(/^\s*(FAKTURA\s+VAT|FAKTURA|FV|F)\s*[:.-]?\s*/, '')
    .replace(/\s+/g, '');
  return s || null;
}

const BEFORE_INVOICE = ['active', 'completed'];

export function planInvoiceSync(provider: ProviderId, remote: RemoteInvoice[], trips: SyncTrip[]) {
  const byExternal = new Map<string, SyncTrip>();
  const byNumber = new Map<string, SyncTrip[]>();
  for (const t of trips) {
    if (t.invoice_provider === provider && t.invoice_external_id) byExternal.set(t.invoice_external_id, t);
    const n = !t.invoice_external_id ? normalizeInvoiceNumber(t.invoice_number) : null;
    if (n) byNumber.set(n, [...(byNumber.get(n) ?? []), t]);
  }
  // Номер, который в сервисе встречается дважды (разные типы документов), не сопоставляем.
  const remoteNumberCount = new Map<string, number>();
  for (const r of remote) {
    const n = normalizeInvoiceNumber(r.number);
    if (n) remoteNumberCount.set(n, (remoteNumberCount.get(n) ?? 0) + 1);
  }

  const updates: SyncUpdate[] = [];
  const unmatched: RemoteInvoice[] = [];

  for (const r of remote) {
    let trip = byExternal.get(r.externalId);
    let linked = false;
    if (!trip) {
      const n = normalizeInvoiceNumber(r.number);
      const cands = n && remoteNumberCount.get(n) === 1 ? byNumber.get(n) ?? [] : [];
      if (cands.length === 1) {
        trip = cands[0];
        linked = true;
      }
    }
    if (!trip) {
      unmatched.push(r);
      continue;
    }

    const patch: TripPatch = {};
    const changes: SyncUpdate['changes'] = [];
    if (linked) {
      patch.invoice_provider = provider;
      patch.invoice_external_id = r.externalId;
      changes.push('linked');
    }
    if (r.number && r.number !== trip.invoice_number && (linked || !trip.invoice_number)) {
      patch.invoice_number = r.number;
      if (!linked) changes.push('number');
    }
    if (r.ksefNumber && r.ksefNumber !== trip.ksef_number) {
      patch.ksef_number = r.ksefNumber;
      patch.ksef_status = 'ok';
      patch.ksef_error = null;
      changes.push('ksef');
    } else if (!r.ksefNumber && linked && !trip.ksef_status) {
      patch.ksef_status = 'pending';
    }
    if (r.paymentDue && r.paymentDue !== trip.payment_due) {
      patch.payment_due = r.paymentDue;
      changes.push('due');
    }
    const status = trip.status ?? '';
    if (r.payment === 'paid' && status !== 'paid' && (status === 'invoiced' || BEFORE_INVOICE.includes(status))) {
      // Оплату ставим только вперёд: «оплачено» в CRM сервис не отменяет.
      patch.status = 'paid';
      if (!trip.invoiced_at && r.issueDate) patch.invoiced_at = r.issueDate;
      changes.push('paid');
    } else if (BEFORE_INVOICE.includes(status)) {
      patch.status = 'invoiced';
      if (!trip.invoiced_at && r.issueDate) patch.invoiced_at = r.issueDate;
      changes.push('invoiced');
    }
    if (Object.keys(patch).length) updates.push({ tripId: trip.id, number: r.number, patch, changes });
  }

  const unpaidUnmatched = unmatched.filter((r) => r.payment !== 'paid');
  return { updates, unmatched, unpaidUnmatched };
}
