import { Truck, Package } from 'lucide-react';
import type { YearTotals } from '../../lib/statistics';
import { getT } from '../../lib/i18n/server';

export default async function StatisticsBreakdown({
  yearTotals,
  tripProfit,
  avgProfitPerTrip,
}: {
  yearTotals: YearTotals;
  tripProfit: number;
  avgProfitPerTrip: number;
}) {
  const { t } = await getT();
  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
      <div className="card p-5 md:p-6">
        <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
          {t('stat.ordersYear')}
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.count')}</span>
            <span className="font-bold text-slate-800 tabular-nums">{yearTotals.tripsCount}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.freightIncome')}</span>
            <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.directExp')}</span>
            <span className="font-bold text-red-500 break-words text-right tabular-nums">−{yearTotals.directExpenses.toFixed(0)} €</span>
          </div>
          <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-slate-700 font-semibold">{t('stat.tripProfit')}</span>
            <span className={`font-bold break-words text-right tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {tripProfit.toFixed(0)} €
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {t('stat.avgTrip')}{' '}<b className="text-slate-600 tabular-nums">{avgProfitPerTrip.toFixed(0)} €</b>
          </div>
        </div>
      </div>

      <div className="card p-5 md:p-6">
        <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
          {t('stat.fwdYear')}
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.count')}</span>
            <span className="font-bold text-slate-800 tabular-nums">{yearTotals.forwardingCount}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.clientIncome')}</span>
            <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-600">{t('stat.toCarriers')}</span>
            <span className="font-bold text-red-500 break-words text-right tabular-nums">−{yearTotals.forwardingContractorSum.toFixed(0)} €</span>
          </div>
          {yearTotals.forwardingExtraExpenses > 0 && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">{t('stat.extraExp')}</span>
              <span className="font-bold text-orange-600 break-words text-right tabular-nums">−{yearTotals.forwardingExtraExpenses.toFixed(0)} €</span>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-slate-700 font-semibold">{t('stat.fwdMarginF')}</span>
            <span className={`font-bold break-words text-right tabular-nums ${yearTotals.forwardingMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {yearTotals.forwardingMargin.toFixed(0)} €
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {t('stat.avgOrder')}{' '}<b className="text-slate-600 tabular-nums">
              {yearTotals.forwardingCount > 0 ? (yearTotals.forwardingMargin / yearTotals.forwardingCount).toFixed(0) : 0} €
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}
