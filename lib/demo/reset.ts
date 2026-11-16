import 'server-only';
import { createClient } from '../supabase/admin';
import { buildDemoData, DEMO_ACCOUNTS, DEMO_CMR_PATH } from './data';
import { demoPassword, isDemoMode } from './mode';

type Admin = Awaited<ReturnType<typeof createClient>>;

/** Метка демо-базы: без неё сброс откажется стирать данные (вдруг DEMO_MODE включили не там). */
const MARKER_KEY = 'demo.marker';
const LAST_RESET_KEY = 'demo.lastReset';
/** Не чаще раза в 10 минут — кнопку на странице входа видят все посетители. */
const MIN_INTERVAL_MS = 10 * 60_000;

/** Минимальный PDF-образец CMR (одна страница с текстом). */
function samplePdf(): Uint8Array {
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
    '4 0 obj<</Length 60>>stream\nBT /F1 28 Tf 160 760 Td (CMR - DEMO) Tj ET\nendstream endobj',
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n');
  return new TextEncoder().encode(body);
}

/** Удалить все строки таблицы (PostgREST требует фильтр — берём заведомо непустую колонку). */
async function wipe(supabase: Admin, table: string, col = 'id') {
  const { error } = await supabase.from(table).delete().not(col, 'is', null);
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`${table}: ${error.message}`);
}

async function insert(supabase: Admin, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 200));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export type DemoResetResult = { ok: true; trips: number } | { ok: false; reason: 'notDemo' | 'notDemoDb' | 'tooSoon' | 'error'; message?: string };

export async function resetDemo(opts: { force?: boolean } = {}): Promise<DemoResetResult> {
  if (!isDemoMode()) return { ok: false, reason: 'notDemo' };
  const supabase = await createClient();

  // Стираем только демо-базу: метка есть, или база пустая (первый запуск).
  const { data: marker } = await supabase.from('integration_state').select('key').eq('key', MARKER_KEY).maybeSingle();
  if (!marker) {
    const { count } = await supabase.from('trips').select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) return { ok: false, reason: 'notDemoDb' };
  }
  if (!opts.force) {
    const { data: last } = await supabase.from('integration_state').select('updated_at').eq('key', LAST_RESET_KEY).maybeSingle();
    if (last?.updated_at && Date.now() - Date.parse(last.updated_at as string) < MIN_INTERVAL_MS) return { ok: false, reason: 'tooSoon' };
  }

  try {
    // 1. Учётки демо (и всё, что посетители могли завести) — с ними уходят профили.
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) await supabase.auth.admin.deleteUser(u.id);
      if (data.users.length < 200) break;
    }

    // 2. Данные — от зависимых к справочникам.
    for (const t of ['purchase_invoices', 'driver_transactions', 'driver_telegram_links', 'client_reminders', 'client_portal_links', 'forwarding_orders', 'trip_documents', 'trips', 'reminders', 'documents', 'fixed_costs', 'audit_log'])
      await wipe(supabase, t);
    await wipe(supabase, 'closed_months', 'month');
    await supabase.from('integration_state').delete().not('key', 'in', `(${MARKER_KEY},${LAST_RESET_KEY})`);
    for (const t of ['clients', 'contractors', 'locations', 'trucks', 'drivers', 'managers']) await wipe(supabase, t);

    // 3. Новые данные «от сегодня».
    const d = buildDemoData(new Date().toISOString().slice(0, 10));
    await supabase.from('company_settings').upsert(d.company, { onConflict: 'id' });
    await insert(supabase, 'managers', d.managers);
    await insert(supabase, 'clients', d.clients);
    await insert(supabase, 'contractors', d.contractors);
    await insert(supabase, 'drivers', d.drivers);
    await insert(supabase, 'trucks', d.trucks);
    await insert(supabase, 'locations', d.locations);
    await insert(supabase, 'trips', d.trips);
    await insert(supabase, 'trip_segments', d.segments);
    await insert(supabase, 'trip_cargo', d.cargo);
    await insert(supabase, 'trip_expenses', d.expenses);
    await insert(supabase, 'trip_documents', d.documents);
    await insert(supabase, 'fixed_costs', d.fixedCosts);
    await supabase.storage.from('documents').upload(DEMO_CMR_PATH, samplePdf(), { contentType: 'application/pdf', upsert: true });

    // 4. Демо-учётки с общим паролем.
    for (const a of DEMO_ACCOUNTS) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: a.email,
        password: demoPassword(),
        email_confirm: true,
        user_metadata: { full_name: a.fullName },
      });
      if (error || !data.user) throw new Error(`${a.email}: ${error?.message}`);
      const { error: pErr } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          role: a.role,
          full_name: a.fullName,
          driver_id: 'driverId' in a ? a.driverId : null,
          manager_id: 'managerId' in a ? a.managerId : null,
        },
        { onConflict: 'id' },
      );
      if (pErr) throw new Error(`profile ${a.email}: ${pErr.message}`);
      if ('driverId' in a) await supabase.from('drivers').update({ user_id: data.user.id }).eq('id', a.driverId);
      if ('managerId' in a) await supabase.from('managers').update({ user_id: data.user.id }).eq('id', a.managerId);
    }

    const now = new Date().toISOString();
    await supabase.from('integration_state').upsert(
      [
        { key: MARKER_KEY, value: 'demo', updated_at: now },
        { key: LAST_RESET_KEY, value: now, updated_at: now },
      ],
      { onConflict: 'key' },
    );
    return { ok: true, trips: d.trips.length };
  } catch (e) {
    console.error('[demo] reset failed:', e);
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
