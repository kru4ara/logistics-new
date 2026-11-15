import 'server-only';
import { createClient } from '../supabase/admin';
import { fetchAll } from '../fetch-all';
import { logAudit } from '../audit';
import { getInvoiceProvider } from './index';
import { planInvoiceSync, type SyncTrip } from './sync-rules';

export type SyncReport =
  | { ok: true; provider: string; checked: number; updated: number; paid: number; ksef: number; linked: number; unpaidUnmatched: number }
  | { ok: false; reason: 'notConfigured' | 'unsupported' | 'error'; message?: string };

const CHANGE_RU: Record<string, string> = {
  linked: 'связана по номеру',
  number: 'номер',
  ksef: 'номер KSeF',
  due: 'срок оплаты',
  invoiced: 'счёт выставлен',
  paid: 'оплачена',
};

/** Сверить заказы с фактурами в сервисе фактур: оплата, срок, номер KSeF, связь по номеру. */
export async function runInvoiceSync(): Promise<SyncReport> {
  const provider = getInvoiceProvider();
  if (!provider) return { ok: false, reason: 'notConfigured' };
  if (!provider.listInvoices) return { ok: false, reason: 'unsupported' };

  let remote;
  try {
    remote = await provider.listInvoices();
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  const supabase = await createClient();
  const { data, error } = await fetchAll(
    supabase
      .from('trips')
      .select('id, status, invoice_provider, invoice_external_id, invoice_number, invoiced_at, payment_due, ksef_number, ksef_status')
      .in('status', ['active', 'completed', 'invoiced', 'paid']),
  );
  if (error || !data) return { ok: false, reason: 'error', message: error?.message };
  const trips = data as unknown as SyncTrip[];

  const plan = planInvoiceSync(provider.id, remote, trips);
  let updated = 0;
  for (const u of plan.updates) {
    const { error: upErr } = await supabase.from('trips').update(u.patch).eq('id', u.tripId);
    if (upErr) {
      console.error('[invoice-sync] update failed', u.tripId, upErr.message);
      continue;
    }
    updated++;
    await logAudit({
      entity_type: 'trip',
      entity_id: u.tripId,
      action: 'update',
      changes: Object.fromEntries(Object.entries(u.patch).map(([k, v]) => [k, { before: null, after: v }])),
      summary: `Сверка с ${provider.name}: фактура ${u.number ?? '—'} — ${u.changes.map((c) => CHANGE_RU[c]).join(', ')}`,
    });
  }

  const count = (c: string) => plan.updates.filter((u) => u.changes.includes(c as never)).length;
  return {
    ok: true,
    provider: provider.name,
    checked: remote.length,
    updated,
    paid: count('paid'),
    ksef: count('ksef'),
    linked: count('linked'),
    unpaidUnmatched: plan.unpaidUnmatched.length,
  };
}
