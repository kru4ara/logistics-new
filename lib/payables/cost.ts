import 'server-only';
import type { createClient } from '../supabase/admin';
import { toEur } from '../fx';
import { segmentCost, costAmount, isCorrectionType, type InvoiceForCost } from './cost-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Пересчитать расход «Подрядчик» участка: есть привязанные счета — по их сумме нетто
 * (доплаты и korekta складываются), нет — по цене из заявки. У участка одна строка
 * такого расхода, поэтому маржа рейса и отчёты не задваиваются.
 * Вызывать после любой привязки/отвязки счёта и после правки участка.
 */
export async function recalcSegmentCost(supabase: Supabase, segmentId: string): Promise<void> {
  const { data: seg } = await supabase
    .from('trip_segments')
    .select('id, trip_id, executor_type, price, currency, date_from, from_city, to_city, contractors(name)')
    .eq('id', segmentId)
    .maybeSingle();
  if (!seg || seg.executor_type !== 'contractor') return;

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

  if (!cost) {
    if (ids.length) await supabase.from('trip_expenses').delete().in('id', ids);
    return;
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
}
