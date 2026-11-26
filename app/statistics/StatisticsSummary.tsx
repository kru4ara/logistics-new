import { Trophy, Truck, Package, TrendingUp, TrendingDown, Wallet, Briefcase } from 'lucide-react';
import type { YearTotals } from '../../lib/statistics';
import { getT } from '../../lib/i18n/server';
import { tPlural } from '../../lib/i18n/translate';
import { formatEur } from '../../lib/i18n/format';

export default async function StatisticsSummary({
  year,
  yearTotals,
  avgMargin,
  capexTotalForYear,
  capexCount,
}: {
  year: number;
  yearTotals: YearTotals;
  avgMargin: number;
  capexTotalForYear: number;
  capexCount: number;
}) {
  const { t, locale } = await getT();
  return (
    <div>
      <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
        {t('stat.summaryFor', { year })}
      </h2>
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs md:text-sm font-medium text-slate-500">{t('stat.deals')}</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Truck className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2.2} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
            {yearTotals.tripsCount + yearTotals.forwardingCount}
          </div>
          <div className="text-[10px] md:text-xs text-slate-400 mt-1 inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-0.5">
              <Truck className="w-3 h-3" strokeWidth={2} />
              <span className="tabular-nums">{yearTotals.tripsCount}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Package className="w-3 h-3" strokeWidth={2} />
              <span className="tabular-nums">{yearTotals.forwardingCount}</span>
            </span>
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs md:text-sm font-medium text-slate-500">{t('stat.income')}</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" strokeWidth={2.2} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
            {formatEur(yearTotals.totalIncome)}
          </div>
          <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
            {t('stat.revenue', { n: yearTotals.tripRevenue.toFixed(0) })}
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs md:text-sm font-medium text-slate-500">{t('stat.opex')}</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-500" strokeWidth={2.2} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
            {formatEur(yearTotals.totalExpenses)}
          </div>
          <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
            {t('stat.expensesN', { n: (yearTotals.directExpenses + yearTotals.fixedExpenses + yearTotals.forwardingContractorSum + yearTotals.forwardingExtraExpenses).toFixed(0) })}
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs md:text-sm font-medium text-slate-500">{t('stat.plProfit')}</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" strokeWidth={2.2} />
            </div>
          </div>
          <div className={`text-xl md:text-2xl font-bold break-words tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatEur(yearTotals.profit)}
          </div>
          <div className="text-[10px] md:text-xs text-slate-400 mt-1">
            {t('stat.marginLbl')}{' '}<b className={avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{avgMargin.toFixed(1)}%</b>
          </div>
        </div>

        <div className="card border-amber-200 p-4 md:p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs md:text-sm font-medium text-amber-700">{t('stat.capex')}</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-amber-600" strokeWidth={2.2} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-amber-600 break-words tabular-nums">
            {capexTotalForYear > 0 ? `${formatEur(capexTotalForYear)}` : '—'}
          </div>
          <div className="text-[10px] md:text-xs text-amber-600/70 mt-1">
            {t('fc.outsidePl', { ops: tPlural(t, locale, 'count2.op', capexCount) })}
          </div>
        </div>
      </div>
    </div>
  );
}
