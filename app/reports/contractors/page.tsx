import { createClient } from '../../../lib/supabase/admin';
import { scopedClient } from '../../../lib/supabase/scoped';
import { fetchAll } from '../../../lib/fetch-all';
import CountryFlag from '../../../app/components/CountryFlag';
import { getT } from '../../../lib/i18n/server';
import { tPlural } from '../../../lib/i18n/translate';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import type { RateRow } from '../../../lib/plan-fact';
import {
  buildContractorTotals,
  factBySegmentOf,
  parsePeriod,
  segmentDate,
  type ContractorSegmentRow,
  type ContractorTotals,
} from '../../../lib/contractor-stats';

export const dynamic = 'force-dynamic';

type ContractorRow = { id: string; name: string; country: string | null };
type Stat = ContractorRow & ContractorTotals;

export default async function ContractorsStatsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { t, locale } = await getT();
  const intl = INTL_LOCALE[locale];
  const eur = (n: number) => n.toLocaleString(intl, { maximumFractionDigits: 0 }) + ' €';
  const eurExact = (n: number) => n.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const today = new Date().toISOString().slice(0, 10);
  const period = parsePeriod((await searchParams).period, today);

  const supabase = await createClient();
  const scoped = await scopedClient();

  const [cRes, segRes, expRes, rateRes] = await Promise.all([
    fetchAll(supabase.from('contractors').select('id, name, country').order('name')),
    // Участки подрядчиков с датой, статусом и режимом заказа.
    fetchAll(
      scoped
        .from('trip_segments')
        .select('id, trip_id, contractor_id, price, currency, contractor_payment_days, trips!inner(status, profit_mode, start_date, end_date)')
        .eq('executor_type', 'contractor')
        .not('contractor_id', 'is', null)
        .order('id'),
    ),
    // Факт: расходы рейса «Подрядчик» по участку (после счёта — сумма счёта).
    fetchAll(
      scoped
        .from('trip_expenses')
        .select('segment_id, amount_eur')
        .eq('category', 'contractor')
        .not('segment_id', 'is', null)
        .order('id'),
    ),
    fetchAll(supabase.from('rates').select('rate_date, pln_to_eur, byn_to_eur').order('rate_date', { ascending: true })),
  ]);
  const loadError = cRes.error ?? segRes.error ?? expRes.error ?? rateRes.error;
  if (loadError) {
    return <div className="p-8 text-red-500">{t('dir.loadError')}{' '}{loadError.message}</div>;
  }

  const segments = (segRes.data ?? []) as unknown as ContractorSegmentRow[];
  const totals = buildContractorTotals(
    segments,
    factBySegmentOf((expRes.data ?? []) as { segment_id: string | null; amount_eur: number | null }[]),
    (rateRes.data ?? []) as RateRow[],
    period,
    today,
  );

  const allStats: Stat[] = ((cRes.data ?? []) as ContractorRow[]).map((c) => ({
    ...c,
    ...(totals.get(c.id) ?? { tripCount: 0, tripFact: 0, fwdCount: 0, fwdFact: 0, count: 0, planEur: 0, factEur: 0, paymentDays: null }),
  }));
  allStats.sort((a, b) => b.factEur - a.factEur || b.planEur - a.planEur || a.name.localeCompare(b.name, intl));

  const activeContractors = allStats.filter((s) => s.count > 0).length;
  const grandFact = allStats.reduce((sum, s) => sum + s.factEur, 0);
  const grandPlan = allStats.reduce((sum, s) => sum + s.planEur, 0);
  const grandCount = allStats.reduce((sum, s) => sum + s.count, 0);
  const top3 = allStats.filter((s) => s.factEur > 0).slice(0, 3);

  // Выбор периода: всё время, годы с работами, месяцы выбранного года.
  const years = Array.from(
    new Set([today.slice(0, 4), ...segments.map((s) => segmentDate(s)?.slice(0, 4)).filter((y): y is string => Boolean(y))]),
  ).sort((a, b) => b.localeCompare(a));
  const selYear = period ? period.key.slice(0, 4) : null;
  const monthLabel = (ym: string) =>
    new Date(`${ym}-01T00:00:00Z`).toLocaleString(intl, { month: 'short', timeZone: 'UTC' });
  const chip = (key: string, label: string, active: boolean) => (
    <a
      key={key}
      href={`/reports/contractors?period=${key}`}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </a>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/reports" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          {t('rep.allReports')}
        </a>

        {/* Заголовок и период */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl shrink-0">🚛</div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('rep.ctrTitle')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('rep.ctrHint')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400 font-medium mr-1">{t('rep.ctrPeriod')}</span>
              {chip('all', t('rep.ctrAllTime'), period === null)}
              {years.map((y) => chip(y, y, period?.key === y))}
            </div>
            {selYear && (
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: 12 }, (_, i) => `${selYear}-${String(i + 1).padStart(2, '0')}`).map((ym) =>
                  chip(ym, monthLabel(ym), period?.key === ym),
                )}
              </div>
            )}
          </div>
        </div>

        {/* Сводка */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('rep.ctrTotal')}</div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900">{allStats.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('rep.ctrActive')}</div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600">{activeContractors}</div>
            <div className="text-xs text-slate-400 mt-1">{t('rep.ctrActiveHint')}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('rep.ctrPaid')}</div>
            <div className="text-2xl md:text-3xl font-bold text-red-500">{eur(grandFact)}</div>
            <div className="text-xs text-slate-400 mt-1">{t('rep.ctrPaidHint', { plan: eur(grandPlan) })}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('ctr.totalWorks')}</div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{grandCount}</div>
          </div>
        </div>

        {/* Топ-3 */}
        {top3.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">{t('rep.top3')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {top3.map((s, idx) => (
                <a
                  key={s.id}
                  href={`/contractors/${s.id}`}
                  className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-amber-50/40 to-white hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-2xl">{['🥇', '🥈', '🥉'][idx]}</span>
                    <span className="text-lg font-bold text-slate-900 break-words text-right">{eur(s.factEur)}</span>
                  </div>
                  <div className="font-semibold text-slate-800 text-sm break-words">{s.name}</div>
                  {s.country && (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <CountryFlag country={s.country} />
                      <span>{s.country}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-2">{tPlural(t, locale, 'count3.job', s.count)}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Полная таблица */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t('rep.allCtr')}</h2>

          {/* Мобильная версия — карточки */}
          <div className="md:hidden space-y-3">
            {allStats.map((s) => {
              const isActive = s.count > 0;
              return (
                <a
                  key={s.id}
                  href={`/contractors/${s.id}`}
                  className={`block border rounded-xl p-4 transition-all ${
                    isActive ? 'border-slate-200 bg-slate-50/40 hover:border-blue-300' : 'border-slate-100 bg-slate-50/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-sm break-words">{s.name}</div>
                      {s.country && (
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <CountryFlag country={s.country} />
                          <span>{s.country}</span>
                        </div>
                      )}
                    </div>
                    <div className={`shrink-0 text-right text-base font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                      {isActive ? eur(s.factEur) : '—'}
                    </div>
                  </div>
                  {isActive && (
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200/60">
                      <div>
                        <div className="text-slate-400">{t('rep.ctrTrips')}</div>
                        <div className="text-slate-700 font-medium">{s.tripCount || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">{t('rep.xlFwd')}</div>
                        <div className="text-slate-700 font-medium">{s.fwdCount || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">{t('rep.ctrPlan')}</div>
                        <div className="text-slate-700 font-medium">{eur(s.planEur)}</div>
                      </div>
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* Десктоп — таблица */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">{t('expenseCat.contractor')}</th>
                  <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">{t('addr.country')}</th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">{t('rep.ctrTrips')}</th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">{t('rep.xlFwd')}</th>
                  <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">{t('rep.ctrPlan')}</th>
                  <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">{t('rep.ctrFact')}</th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">{t('ctr.payment')}</th>
                </tr>
              </thead>
              <tbody>
                {allStats.map((s) => {
                  const isActive = s.count > 0;
                  return (
                    <tr key={s.id} className={`border-b border-slate-50 transition-colors ${isActive ? 'hover:bg-slate-50/60' : 'opacity-50'}`}>
                      <td className="py-3 text-sm">
                        <a href={`/contractors/${s.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors">
                          {s.name}
                        </a>
                      </td>
                      <td className="py-3 text-sm text-slate-500">
                        {s.country ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CountryFlag country={s.country} />
                            <span>{s.country}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 text-center text-sm text-slate-700">{s.tripCount || '—'}</td>
                      <td className="py-3 text-center text-sm text-slate-700">{s.fwdCount || '—'}</td>
                      <td className="py-3 text-right text-sm text-slate-500 tabular-nums">{isActive ? eur(s.planEur) : '—'}</td>
                      <td className="py-3 text-right text-sm font-bold text-red-500 tabular-nums">{isActive ? eurExact(s.factEur) : '—'}</td>
                      <td className="py-3 text-center text-xs text-slate-500">{s.paymentDays ? t('ctr.days', { n: s.paymentDays }) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {allStats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-between items-baseline gap-2 text-sm">
              <span className="text-slate-500">
                {t('rep.shown')}{' '}<b className="text-slate-700">{allStats.length}</b>{' '}{t('rep.ctrWithWorks')}{' '}<b className="text-slate-700">{activeContractors}</b>
              </span>
              <span className="text-slate-500">
                {t('rep.sumTotal')}{' '}<b className="text-red-500 text-base">{eurExact(grandFact)}</b>
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
