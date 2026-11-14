import { BarChart3, TrendingUp, Gauge, Fuel } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';

export default async function DriverStats({
  totalTrips,
  activeTripsCount,
  totalRevenue,
  totalKm,
  avgConsumption,
}: {
  totalTrips: number;
  activeTripsCount: number;
  totalRevenue: number;
  totalKm: number;
  avgConsumption: number | null;
}) {
  const { t, locale } = await getT();
  return (
    <div>
      <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
        {t('drvCard.work')}
      </h2>
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">{t('drvCard.totalTrips')}</span>
            <BarChart3 className="w-4 h-4 text-brand-600" strokeWidth={2} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">{totalTrips}</div>
          {activeTripsCount > 0 && (
            <div className="text-xs text-brand-500 mt-1">{t('drvCard.activeTrips', { n: activeTripsCount })}</div>
          )}
        </div>
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">{t('drvCard.totalFreight')}</span>
            <TrendingUp className="w-4 h-4 text-green-600" strokeWidth={2} />
          </div>
          <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
            {totalRevenue > 0 ? `${Math.round(totalRevenue).toLocaleString(INTL_LOCALE[locale])} €` : '—'}
          </div>
        </div>
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">{t('drvCard.distance')}</span>
            <Gauge className="w-4 h-4 text-slate-600" strokeWidth={2} />
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-800 break-words tabular-nums">
            {totalKm > 0 ? `${Math.round(totalKm).toLocaleString(INTL_LOCALE[locale])} ${t('units.km')}` : '—'}
          </div>
        </div>
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">{t('drvCard.avgCons')}</span>
            <Fuel className="w-4 h-4 text-slate-600" strokeWidth={2} />
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-800 tabular-nums">
            {avgConsumption !== null ? `${avgConsumption.toFixed(1)} ${t('drvCard.l100')}` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
