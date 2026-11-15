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

/** Изменения заказа по фактуре сервиса; linked — связь устанавливается сейчас. */
export function patchFromRemote(provider: ProviderId, r: RemoteInvoice, trip: SyncTrip, linked: boolean) {
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
  // Дата счёта — из сервиса, если в CRM её нет (номер вписан вручную, заказ уже оплачен…).
  if (!trip.invoiced_at && r.issueDate) patch.invoiced_at = r.issueDate;
  const status = trip.status ?? '';
  if (r.payment === 'paid' && status !== 'paid' && (status === 'invoiced' || BEFORE_INVOICE.includes(status))) {
    // Оплату ставим только вперёд: «оплачено» в CRM сервис не отменяет.
    patch.status = 'paid';
    changes.push('paid');
  } else if (BEFORE_INVOICE.includes(status)) {
    patch.status = 'invoiced';
    changes.push('invoiced');
  }
  return { patch, changes };
}

/** Убрать из списка «без заказа» уже отмеченные «не к заказу». */
export function visibleUnmatched(unmatched: RemoteInvoice[], ignored: string[]): RemoteInvoice[] {
  const skip = new Set(ignored);
  return unmatched.filter((r) => !skip.has(r.externalId));
}

export type TripOption = { id: string; trip_number: string | null; client_tax_id: string | null; revenue_eur: number | null; date: string | null };

/**
 * Заказы-кандидаты для фактуры без заказа: сначала того же покупателя (по NIP),
 * затем с совпадающей суммой, затем ближе по дате.
 */
export function rankTripsForInvoice(r: RemoteInvoice, trips: TripOption[]): (TripOption & { score: number })[] {
  const nip = (v: string | null) => (v ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/^PL(?=\d{10}$)/, '');
  const buyer = nip(r.buyerTaxId);
  const issue = Date.parse(r.issueDate ?? '');
  return trips
    .map((t) => {
      let score = 0;
      if (buyer && nip(t.client_tax_id) === buyer) score += 50;
      if (r.gross != null && t.revenue_eur != null && (r.currency ?? 'EUR') === 'EUR' && Math.abs(r.gross - t.revenue_eur) <= 1) score += 30;
      const d = Date.parse(t.date ?? '');
      if (!Number.isNaN(issue) && !Number.isNaN(d)) score += Math.max(0, 20 - Math.abs(issue - d) / 86_400_000 / 3);
      return { ...t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((t) => ({ ...t, score: Math.round(t.score) }));
}

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

    const { patch, changes } = patchFromRemote(provider, r, trip, linked);
    if (Object.keys(patch).length) updates.push({ tripId: trip.id, number: r.number, patch, changes });
  }

  const unpaidUnmatched = unmatched.filter((r) => r.payment !== 'paid');
  return { updates, unmatched, unpaidUnmatched };
}
