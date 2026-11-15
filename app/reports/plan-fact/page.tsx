import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Scale, ArrowLeft, Lock } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import { getSessionContext } from '../../../lib/session';
import { can, deniedRedirect } from '../../../lib/roles';
import { formatDateTime } from '../../../lib/i18n/format';
import { previewSegmentCost } from '../../../lib/payables/cost';
import { CloseMonthButton, ApplyCostButton } from './MonthControls';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { buildPlanFact, eurAt, monthRange, type ClientPF, type RateRow, type SegmentPF } from '../../../lib/plan-fact';

export const dynamic = 'force-dynamic';

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default async function PlanFactPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { role } = await getSessionContext();
  // Отчёт без скоупа менеджера — право *.viewAll.
  const denied = deniedRedirect(role, 'reports.viewAll');
  if (denied) redirect(denied);
  const { t, locale } = await getT();
  const today = new Date().toISOString().slice(0, 10);
  const { month, from, to } = monthRange((await searchParams).month, today);
  const eur = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const signed = (n: number) => (n > 0 ? `+${eur(n)}` : eur(n));

  const supabase = await createClient();
  const inMonth = `and(start_date.gte.${from},start_date.lt.${to}),and(start_date.is.null,end_date.gte.${from},end_date.lt.${to})`;
  const BASE = 'id, trip_number, revenue_eur, invoice_number, start_date, end_date, clients(name)';
  let tripsRes = await fetchAll(supabase.from('trips').select(`${BASE}, invoice_amount, invoice_currency`).or(inMonth).neq('status', 'planned'));
  if (tripsRes.error && /invoice_amount|invoice_currency/.test(tripsRes.error.message)) {
    tripsRes = (await fetchAll(supabase.from('trips').select(BASE).or(inMonth).neq('status', 'planned'))) as typeof tripsRes;
  }
  if (tripsRes.error) return <div className="p-8 text-red-600">{t('trip.loadError', { msg: tripsRes.error.message })}</div>;
  const trips = (tripsRes.data ?? []) as any[];
  const tripById = new Map(trips.map((tr) => [tr.id as string, tr]));
  const tripIds = trips.map((tr) => tr.id as string);

  const { data: segRows } = await fetchAllByIds(tripIds, (chunk) =>
    supabase
      .from('trip_segments')
      .select('id, trip_id, position, contractor_id, price, currency, date_from, contractors(name)')
      .eq('executor_type', 'contractor')
      .in('trip_id', chunk),
  );
  const segs = (segRows ?? []) as any[];
  const segIds = segs.map((s) => s.id as string);
  const [{ data: expRows }, invRes, { data: rates }] = await Promise.all([
    fetchAllByIds(segIds, (chunk) =>
      supabase.from('trip_expenses').select('segment_id, amount_eur').eq('category', 'contractor').in('segment_id', chunk),
    ),
    fetchAllByIds(segIds, (chunk) => supabase.from('purchase_invoices').select('segment_id').in('segment_id', chunk)),
    fetchAll(supabase.from('rates').select('rate_date, pln_to_eur, byn_to_eur').order('rate_date', { ascending: true })),
  ]);
  const expBySeg = new Map<string, number>();
  for (const e of (expRows ?? []) as any[]) expBySeg.set(e.segment_id, (expBySeg.get(e.segment_id) ?? 0) + (Number(e.amount_eur) || 0));
  const invCount = new Map<string, number>();
  for (const r of ((invRes.error ? [] : invRes.data) ?? []) as any[]) invCount.set(r.segment_id, (invCount.get(r.segment_id) ?? 0) + 1);

  const segments: SegmentPF[] = segs.map((s) => {
    const tr = tripById.get(s.trip_id);
    const date = String(s.date_from ?? tr?.start_date ?? tr?.end_date ?? today).slice(0, 10);
    const price = s.price != null ? Number(s.price) : null;
    const count = invCount.get(s.id) ?? 0;
    return {
      segmentId: s.id,
      tripId: s.trip_id,
      tripNumber: tr?.trip_number ?? null,
      position: s.position ?? 1,
      contractorId: s.contractor_id,
      contractorName: one<{ name: string }>(s.contractors)?.name ?? null,
      planEur: price != null && price > 0 ? eurAt(price, s.currency, date, (rates ?? []) as RateRow[]) : null,
      factEur: count > 0 ? expBySeg.get(s.id) ?? null : null,
      invoiceCount: count,
    };
  });
  const clients: ClientPF[] = trips.map((tr) => ({
    tripId: tr.id,
    tripNumber: tr.trip_number,
    clientName: one<{ name: string }>(tr.clients)?.name ?? null,
    invoiceNumber: tr.invoice_number,
    revenueEur: tr.revenue_eur != null ? Number(tr.revenue_eur) : null,
    invoiceEur:
      tr.invoice_amount != null && (!tr.invoice_currency || String(tr.invoice_currency).toUpperCase() === 'EUR') ? Number(tr.invoice_amount) : null,
  }));
  const r = buildPlanFact(segments, clients);

  // Закрытие месяца: итоги на момент закрытия и изменения по счетам, ждущие подтверждения.
  const canClose = can(role, 'months.close');
  const { data: closedRow, error: closedErr } = await supabase.from('closed_months').select('*').eq('month', month).maybeSingle();
  const closed = !closedErr && closedRow ? (closedRow as { closed_at: string; closed_by: string | null; snapshot: Record<string, number> | null }) : null;
  const pending: { seg: SegmentPF; currentEur: number | null; targetEur: number | null }[] = [];
  if (closed) {
    for (const s of segments.filter((x) => x.invoiceCount > 0)) {
      const p = await previewSegmentCost(supabase, s.segmentId);
      if (p?.pending) pending.push({ seg: s, currentEur: p.currentEur, targetEur: p.targetEur });
    }
  }
  const monthLabel = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`));

  const tripLink = (id: string, n: string | null, pos?: number) => (
    <Link href={`/trips/${id}`} className="text-brand-600 hover:underline">
      №{n ?? '—'}{pos != null ? ` · ${t('pf.leg', { n: pos })}` : ''}
    </Link>
  );
  const diffCls = (d: number) => (d > 0 ? 'text-red-600' : 'text-emerald-700');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <Link href="/reports" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          {t('pf.back')}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Scale className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              {t('pf.title')}
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">{t('pf.hint')}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
          {canClose && !closedErr && <CloseMonthButton month={month} closed={Boolean(closed)} label={monthLabel} />}
          <form className="flex items-center gap-2" method="get">
            <input type="month" name="month" defaultValue={month} className="input text-sm" />
            <button type="submit" className="btn btn-secondary text-sm">{t('pf.show')}</button>
          </form>
          </div>
        </div>

        {closed && (
          <section className="card p-4 md:p-5 border border-slate-300 bg-slate-50 space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <Lock className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
              <div>
                <div className="font-semibold">{t('pf.closedTitle', { date: formatDateTime(closed.closed_at, locale), who: closed.closed_by ?? '—' })}</div>
                {closed.snapshot && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('pf.snapshot', {
                      trips: closed.snapshot.trips ?? 0,
                      revenue: eur(closed.snapshot.revenueEur ?? 0),
                      expenses: eur(closed.snapshot.expensesEur ?? 0),
                      margin: eur(closed.snapshot.marginEur ?? 0),
                    })}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-0.5">{t('pf.closedHint')}</div>
              </div>
            </div>
            {pending.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-amber-700 mb-1">{t('pf.pending', { n: pending.length })}</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-200">
                    {pending.map(({ seg, currentEur, targetEur }) => (
                      <tr key={seg.segmentId}>
                        <td className="py-2 pr-3">{tripLink(seg.tripId, seg.tripNumber, seg.position)}</td>
                        <td className="py-2 pr-3">{seg.contractorName ?? '—'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{t('pf.pendingAmounts', { now: eur(currentEur ?? 0), target: eur(targetEur ?? 0) })}</td>
                        <td className="py-2 text-right">{canClose && <ApplyCostButton segmentId={seg.segmentId} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('pf.kpiInvoiced')}</div>
            <div className="text-xl font-bold text-slate-900">{r.totals.invoiced} / {r.totals.segments}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('pf.kpiContractors')}</div>
            <div className={`text-xl font-bold tabular-nums ${diffCls(r.totals.contractorDiff)}`}>{signed(r.totals.contractorDiff)}</div>
            <div className="text-[11px] text-slate-400">{t('pf.kpiContractorsHint', { plan: eur(r.totals.planEur), fact: eur(r.totals.factEur) })}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('pf.kpiClients')}</div>
            <div className={`text-xl font-bold tabular-nums ${r.totals.clientDiff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{signed(r.totals.clientDiff)}</div>
            <div className="text-[11px] text-slate-400">{t('pf.kpiClientsHint')}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('pf.kpiMargin')}</div>
            <div className={`text-xl font-bold tabular-nums ${r.totals.marginImpact >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{signed(r.totals.marginImpact)}</div>
            <div className="text-[11px] text-slate-400">{t('pf.kpiMarginHint')}</div>
          </div>
        </div>

        <section className="card p-4 md:p-5 overflow-x-auto">
          <h2 className="font-bold text-slate-900 mb-3">{t('pf.byContractor')}</h2>
          {r.contractors.length === 0 ? (
            <p className="text-sm text-slate-400">{t('pf.noSegments')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-2 pr-3">{t('pf.colContractor')}</th>
                  <th className="py-2 pr-3 text-right">{t('pf.colLegs')}</th>
                  <th className="py-2 pr-3 text-right">{t('pf.colPlan')}</th>
                  <th className="py-2 pr-3 text-right">{t('pf.colFact')}</th>
                  <th className="py-2 pr-3 text-right">{t('pf.colDiff')}</th>
                  <th className="py-2 text-right">{t('pf.colOver')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.contractors.map((c) => (
                  <tr key={c.contractorId ?? c.name}>
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.invoiced} / {c.segments}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.invoiced ? eur(c.planEur) : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.invoiced ? eur(c.factEur) : '—'}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${c.diffEur ? diffCls(c.diffEur) : 'text-slate-400'}`}>{c.invoiced ? signed(c.diffEur) : '—'}</td>
                    <td className={`py-2 text-right tabular-nums ${c.over ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{c.over}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {r.segDiffs.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-3">{t('pf.segDiffs', { n: r.segDiffs.length })}</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {r.segDiffs.map((s) => (
                  <tr key={s.segmentId}>
                    <td className="py-2 pr-3">{tripLink(s.tripId, s.tripNumber, s.position)}</td>
                    <td className="py-2 pr-3">{s.contractorName ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{t('pf.planFact', { plan: eur(s.planEur ?? 0), fact: eur(s.factEur ?? 0) })}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${diffCls(s.diffEur)}`}>{signed(s.diffEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {r.clientDiffs.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-1">{t('pf.clientDiffs', { n: r.clientDiffs.length })}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('pf.clientDiffsHint')}</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {r.clientDiffs.map((c) => (
                  <tr key={c.tripId}>
                    <td className="py-2 pr-3">{tripLink(c.tripId, c.tripNumber)}</td>
                    <td className="py-2 pr-3">{c.clientName ?? '—'}</td>
                    <td className="py-2 pr-3">{c.invoiceNumber ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{t('pf.freightInvoice', { freight: eur(c.revenueEur ?? 0), invoice: eur(c.invoiceEur ?? 0) })}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${c.diffEur >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{signed(c.diffEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {r.missing.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-1">{t('pf.missing', { n: r.missing.length })}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('pf.missingHint')}</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {r.missing.map((s) => (
                  <tr key={s.segmentId}>
                    <td className="py-2 pr-3">{tripLink(s.tripId, s.tripNumber, s.position)}</td>
                    <td className="py-2 pr-3">{s.contractorName ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums">{s.planEur != null ? eur(s.planEur) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}
