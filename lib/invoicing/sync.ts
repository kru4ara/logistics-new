import 'server-only';
import { createClient } from '../supabase/admin';
import { fetchAll } from '../fetch-all';
import { logAudit } from '../audit';
import { getInvoiceProvider } from './index';
import { planInvoiceSync, visibleUnmatched, type SyncTrip } from './sync-rules';
import type { RemoteInvoice } from './types';

export type SyncReport =
  | { ok: true; provider: string; checked: number; updated: number; paid: number; ksef: number; linked: number; unpaidUnmatched: number }
  | { ok: false; reason: 'notConfigured' | 'unsupported' | 'error'; message?: string };

const UNMATCHED_KEY = 'invoicing.unmatched';
const IGNORED_KEY = 'invoicing.ignored';

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function readJson<T>(supabase: Supabase, key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('integration_state').select('value').eq('key', key).maybeSingle();
  try {
    return data?.value ? (JSON.parse(data.value) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(supabase: Supabase, key: string, value: unknown) {
  await supabase.from('integration_state').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
}

export type UnmatchedState = { at: string; provider: string; items: RemoteInvoice[] };

/** Неоплаченные фактуры сервиса без заказа в CRM (после последней сверки), без отмеченных «не к заказу». */
export async function readUnmatched(supabase: Supabase): Promise<UnmatchedState | null> {
  const state = await readJson<UnmatchedState | null>(supabase, UNMATCHED_KEY, null);
  if (!state) return null;
  const ignored = await readJson<string[]>(supabase, IGNORED_KEY, []);
  return { ...state, items: visibleUnmatched(state.items, ignored) };
}

/** Убрать фактуру из списка «без заказа»: привязана к заказу или не относится к заказам. */
export async function dropUnmatched(supabase: Supabase, externalId: string, ignore: boolean) {
  const state = await readJson<UnmatchedState | null>(supabase, UNMATCHED_KEY, null);
  if (state) await writeJson(supabase, UNMATCHED_KEY, { ...state, items: state.items.filter((r) => r.externalId !== externalId) });
  if (ignore) {
    const ignored = await readJson<string[]>(supabase, IGNORED_KEY, []);
    if (!ignored.includes(externalId)) await writeJson(supabase, IGNORED_KEY, [...ignored, externalId].slice(-2000));
  }
}

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

  // Неоплаченные без заказа — сохраняем для списка в дебиторке.
  await writeJson(supabase, UNMATCHED_KEY, {
    at: new Date().toISOString(),
    provider: provider.id,
    items: plan.unpaidUnmatched.slice(0, 300),
  } satisfies UnmatchedState);
  const ignored = await readJson<string[]>(supabase, IGNORED_KEY, []);

  const count = (c: string) => plan.updates.filter((u) => u.changes.includes(c as never)).length;
  return {
    ok: true,
    provider: provider.name,
    checked: remote.length,
    updated,
    paid: count('paid'),
    ksef: count('ksef'),
    linked: count('linked'),
    unpaidUnmatched: visibleUnmatched(plan.unpaidUnmatched, ignored).length,
  };
}
