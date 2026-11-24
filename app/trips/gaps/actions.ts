'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../../lib/require-office';
import { createClient } from '../../../lib/supabase/admin';
import { logAudit } from '../../../lib/audit';
import { isMonthClosed } from '../../../lib/closed-months';
import { getT } from '../../../lib/i18n/server';

type Result = { ok: boolean; message?: string; fixed?: number };

/** Закрыть дыру: старт рейса = день после финиша предыдущего рейса машины (миграция 046). */
async function fixOne(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string) {
  const { data: before } = await supabase.from('trips').select('trip_number, start_date, end_date').eq('id', tripId).maybeSingle();
  if (!before) return { ok: false as const, closed: false };
  const month = String(before.start_date ?? before.end_date ?? '').slice(0, 7);
  if (month && (await isMonthClosed(supabase, month))) return { ok: false as const, closed: true };
  const { error } = await supabase.rpc('apply_trip_chain', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  const { data: after } = await supabase.from('trips').select('start_date').eq('id', tripId).maybeSingle();
  if (String(after?.start_date ?? '') !== String(before.start_date ?? '')) {
    await logAudit({
      entity_type: 'trip',
      entity_id: tripId,
      action: 'update',
      changes: { start_date: { before: before.start_date, after: after?.start_date ?? null } },
      summary: `Рейс №${before.trip_number ?? '—'}: старт по цепочке машины — ${String(after?.start_date ?? '').slice(0, 10)}`,
    });
  }
  return { ok: true as const, closed: false };
}

export async function closeTripGap(tripId: string): Promise<Result> {
  await requireCapability('reports.viewAll');
  await requireCapability('trips.editAny');
  const { t } = await getT();
  const supabase = await createClient();
  try {
    const r = await fixOne(supabase, tripId);
    if (!r.ok) return { ok: false, message: r.closed ? t('chain.errClosed') : t('chain.errNotFound') };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath('/trips/gaps');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, fixed: 1 };
}

/** Закрыть все дыры из списка (рейсы в закрытых месяцах пропускаются). */
export async function closeAllTripGaps(tripIds: string[]): Promise<Result> {
  await requireCapability('reports.viewAll');
  await requireCapability('trips.editAny');
  const { t } = await getT();
  const supabase = await createClient();
  let fixed = 0;
  let skipped = 0;
  // По порядку списка (по машинам и датам): старт следующего зависит от финиша предыдущего.
  for (const id of tripIds.slice(0, 500)) {
    try {
      const r = await fixOne(supabase, id);
      if (r.ok) fixed++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  revalidatePath('/trips/gaps');
  return { ok: true, fixed, message: skipped ? t('chain.skipped', { n: skipped }) : undefined };
}

/** «Оставить как есть»: старт рейса не по цепочке (шёл одновременно с другим рейсом машины). */
export async function keepTripAsIs(tripId: string): Promise<Result> {
  await requireCapability('reports.viewAll');
  await requireCapability('trips.editAny');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: trip } = await supabase.from('trips').select('trip_number').eq('id', tripId).maybeSingle();
  if (!trip) return { ok: false, message: t('chain.errNotFound') };
  const { error } = await supabase.from('trips').update({ chain_exempt: true }).eq('id', tripId);
  if (error) return { ok: false, message: t('chain.needMigration') };
  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { chain_exempt: { before: false, after: true } },
    summary: `Рейс №${trip.trip_number ?? '—'}: старт вне цепочки машины (оставлен как есть)`,
  });
  revalidatePath('/trips/gaps');
  return { ok: true };
}
