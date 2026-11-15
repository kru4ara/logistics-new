'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../../lib/require-office';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import { logAudit } from '../../../lib/audit';
import { getT } from '../../../lib/i18n/server';
import { getSessionContext } from '../../../lib/session';
import { monthRange } from '../../../lib/plan-fact';
import { recalcSegmentCost } from '../../../lib/payables/cost';

type Result = { ok: boolean; message?: string };

const MONTH = /^\d{4}-\d{2}$/;
// audit_log.entity_id — uuid; записи о компании в целом — под этим id (как в настройках).
const COMPANY_AUDIT_ID = '00000000-0000-0000-0000-000000000001';

/** Закрыть месяц: дальше стоимость подрядчиков его рейсов меняется только с подтверждения. */
export async function closeMonth(month: string): Promise<Result> {
  await requireCapability('months.close');
  const { t } = await getT();
  if (!MONTH.test(month)) return { ok: false, message: t('pf.errMonth') };
  const supabase = await createClient();
  const { from, to } = monthRange(month, month + '-01');

  // Итоги на момент закрытия — чтобы потом было с чем сравнить.
  const inMonth = `and(start_date.gte.${from},start_date.lt.${to}),and(start_date.is.null,end_date.gte.${from},end_date.lt.${to})`;
  const { data: trips } = await fetchAll(supabase.from('trips').select('id, revenue_eur').or(inMonth).neq('status', 'planned'));
  const ids = ((trips ?? []) as { id: string }[]).map((x) => x.id);
  const { data: exp } = await fetchAllByIds(ids, (chunk) => supabase.from('trip_expenses').select('amount_eur').in('trip_id', chunk));
  const revenue = ((trips ?? []) as { revenue_eur: number | null }[]).reduce((s, x) => s + (Number(x.revenue_eur) || 0), 0);
  const expenses = ((exp ?? []) as { amount_eur: number | null }[]).reduce((s, x) => s + (Number(x.amount_eur) || 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const session = await getSessionContext();
  const { error } = await supabase.from('closed_months').upsert({
    month,
    closed_at: new Date().toISOString(),
    closed_by: session.userName ?? null,
    snapshot: { trips: ids.length, revenueEur: r2(revenue), expensesEur: r2(expenses), marginEur: r2(revenue - expenses) },
  });
  if (error) return { ok: false, message: /closed_months/.test(error.message) ? t('pf.needMigration') : t('dir.updateError', { msg: error.message }) };
  await logAudit({ entity_type: 'company', entity_id: COMPANY_AUDIT_ID, action: 'update', changes: {}, summary: `Месяц ${month} закрыт` });
  revalidatePath('/reports/plan-fact');
  return { ok: true };
}

export async function reopenMonth(month: string): Promise<Result> {
  await requireCapability('months.close');
  const { t } = await getT();
  if (!MONTH.test(month)) return { ok: false, message: t('pf.errMonth') };
  const supabase = await createClient();
  const { error } = await supabase.from('closed_months').delete().eq('month', month);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await logAudit({ entity_type: 'company', entity_id: COMPANY_AUDIT_ID, action: 'update', changes: {}, summary: `Месяц ${month} открыт` });
  revalidatePath('/reports/plan-fact');
  return { ok: true };
}

/** Применить к закрытому месяцу изменение стоимости подрядчика по счетам (явное подтверждение). */
export async function applyClosedCost(segmentId: string): Promise<Result> {
  await requireCapability('months.close');
  const supabase = await createClient();
  const { data: seg } = await supabase.from('trip_segments').select('trip_id, position').eq('id', segmentId).maybeSingle();
  await recalcSegmentCost(supabase, segmentId, { force: true });
  if (seg) {
    await logAudit({
      entity_type: 'trip',
      entity_id: seg.trip_id,
      action: 'update',
      changes: {},
      summary: `Стоимость подрядчика участка ${seg.position} пересчитана по счетам в закрытом месяце (подтверждено)`,
    });
    revalidatePath(`/trips/${seg.trip_id}`);
  }
  revalidatePath('/reports/plan-fact');
  return { ok: true };
}
