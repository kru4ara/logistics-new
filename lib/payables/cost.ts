import 'server-only';
import type { createClient } from '../supabase/admin';
import { toEur } from '../fx';
import { segmentCost, costAmount, isCorrectionType, type InvoiceForCost } from './cost-rules';
import { isMonthClosed, tripMonth } from '../closed-months';

type Supabase = Awaited<ReturnType<typeof createClient>>;

type SegRow = { id: string; price: number | string | null; currency: string | null; date_from: string | null };

/** Что должно стоять в расходе участка по счетам и плану (без записи). */
async function computeCost(supabase: Supabase, seg: SegRow) {
  const segmentId = seg.id;
  const today = new Date().toISOString().slice(0, 10);
  const { data: invRows } = await supabase
    .from('purchase_invoices')
    .select('invoice_number, invoice_type, net_amount, gross_amount, currency, issue_date')
    .eq('segment_id', segmentId)
    .order('issue_date', { ascending: true });
  const invoices: (InvoiceForCost & { number: string | null })[] = [];
  for (const r of (invRows ?? []) as any[]) {
    const net = r.net_amount != null ? Number(r.net_amount) : null;
    const gross = r.gross_amount != null ? Number(r.gross_amount) : null;
    const amount = costAmount({ net, gross });
    invoices.push({
      number: r.invoice_number,
      isCorrection: isCorrectionType(r.invoice_type),
      net,
      gross,
      currency: r.currency,
      netEur: amount == null ? null : await toEur(supabase, amount, r.currency, r.issue_date || today),
    });
  }

  const price = seg.price != null ? Number(seg.price) : null;
  const priceEur = price != null && price > 0 ? await toEur(supabase, price, seg.currency, seg.date_from || today) : null;
  const cost = segmentCost({ price: price && price > 0 ? price : null, currency: seg.currency, priceEur }, invoices);

  const { data: rows } = await supabase
    .from('trip_expenses')
    .select('id')
    .eq('segment_id', segmentId)
    .eq('category', 'contractor');
  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);

  return { invoices, cost, ids };
}

/**
 * Предпросмотр для закрытого месяца: сумма расхода сейчас и сумма по счетам/плану.
 * pending — они расходятся (изменение ждёт подтверждения).
 */
export async function previewSegmentCost(supabase: Supabase, segmentId: string) {
  const { data: seg } = await supabase
    .from('trip_segments')
    .select('id, price, currency, date_from, executor_type')
    .eq('id', segmentId)
    .maybeSingle();
  if (!seg || seg.executor_type !== 'contractor') return null;
  const { cost, ids } = await computeCost(supabase, seg as SegRow);
  let currentEur: number | null = null;
  if (ids.length) {
    const { data } = await supabase.from('trip_expenses').select('amount_eur').in('id', ids);
    currentEur = ((data ?? []) as { amount_eur: number | string | null }[]).reduce((sum, r) => sum + (Number(r.amount_eur) || 0), 0);
  }
  const targetEur = cost?.amountEur ?? null;
  const pending = (currentEur ?? 0) !== (targetEur ?? 0) && Math.abs((currentEur ?? 0) - (targetEur ?? 0)) >= 0.01;
  return { currentEur, targetEur, pending };
}

/**
 * Пересчитать расход «Подрядчик» участка: есть привязанные счета — по их сумме нетто
 * (доплаты и korekta складываются), нет — по цене из заявки. У участка одна строка
 * такого расхода, поэтому маржа рейса и отчёты не задваиваются.
 * Вызывать после любой привязки/отвязки счёта и после правки участка.
 *
 * Месяц рейса закрыт — без force ничего не меняет (вернёт 'closed'): изменение ждёт
 * подтверждения в отчёте «План → факт».
 */
export async function recalcSegmentCost(
  supabase: Supabase,
  segmentId: string,
  opts: { force?: boolean } = {},
): Promise<'updated' | 'closed' | 'skipped'> {
  const { data: seg } = await supabase
    .from('trip_segments')
    .select('id, trip_id, executor_type, price, currency, date_from, from_city, to_city, contractors(name), trips(start_date, end_date)')
    .eq('id', segmentId)
    .maybeSingle();
  if (!seg || seg.executor_type !== 'contractor') return 'skipped';
  const trip = (Array.isArray(seg.trips) ? seg.trips[0] : seg.trips) as { start_date: string | null; end_date: string | null } | null;
  if (!opts.force && (await isMonthClosed(supabase, tripMonth(trip)))) return 'closed';

  const { invoices, cost, ids } = await computeCost(supabase, seg);
  if (!cost) {
    if (ids.length) await supabase.from('trip_expenses').delete().in('id', ids);
    return 'updated';
  }

  const contractor = (Array.isArray(seg.contractors) ? seg.contractors[0] : seg.contractors) as { name: string } | null;
  const route = [seg.from_city, seg.to_city].filter(Boolean).join(' → ');
  const numbers = invoices.filter((i) => (costAmount(i) ?? 0) !== 0).map((i) => i.number).filter(Boolean).join(', ');
  const description =
    `Подрядчик: ${contractor?.name || 'Подрядчик'}${route ? ` · ${route}` : ''}` +
    (cost.actual ? ` · по счетам${numbers ? `: ${numbers}` : ''}` : '');
  const fields = {
    amount_eur: cost.amountEur,
    original_amount: cost.originalAmount,
    currency: cost.currency,
    description,
  };

  if (ids.length) {
    await supabase.from('trip_expenses').update(fields).eq('id', ids[0]);
    if (ids.length > 1) await supabase.from('trip_expenses').delete().in('id', ids.slice(1));
  } else {
    await supabase.from('trip_expenses').insert({
      ...fields,
      trip_id: seg.trip_id,
      segment_id: segmentId,
      category: 'contractor',
      liters: null,
      expense_date: seg.date_from || null,
    });
  }
  return 'updated';
}
