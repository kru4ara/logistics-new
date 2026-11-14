import { Download, AlertTriangle } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';
import { formatDate } from '../../../lib/i18n/format';

export default async function DriverCardDownload({
  driver,
  driverCardBadge,
  DRIVER_CARD_PERIOD,
  DRIVER_CARD_WARN,
}: {
  driver: any;
  driverCardBadge: { color: string; label: string; daysAgo: number | null };
  DRIVER_CARD_PERIOD: number;
  DRIVER_CARD_WARN: number;
}) {
  const { t, locale } = await getT();
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-5 h-5 text-brand-600" strokeWidth={2} />
          {t('drv.cardRead')}
        </h2>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${driverCardBadge.color}`}>
          {driverCardBadge.label}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
            {t('drv.cardLast')}
          </div>
          <div className="text-slate-800 font-medium tabular-nums">
            {formatDate(driver.driver_card_last_download, locale)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
            {t('drvCard.limit')}
          </div>
          <div className="text-slate-800 font-medium tabular-nums">
            {t('drvCard.limitValue', { n: DRIVER_CARD_PERIOD, warn: DRIVER_CARD_WARN })}
          </div>
        </div>
      </div>

      {driverCardBadge.daysAgo === null && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          {t('drvCard.noCardDate')} <b>«{t('trip.edit')}»</b>.
        </div>
      )}

      {driverCardBadge.daysAgo !== null && driverCardBadge.daysAgo > DRIVER_CARD_PERIOD && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
          <span>
            <b>{t('drvCard.overdue')}</b> {t('drvCard.overdueA')} <b>{t('drvCard.overdueDaysB', { n: DRIVER_CARD_PERIOD })}</b>{' '}
            {t('drvCard.overdueC')}
          </span>
        </div>
      )}
    </div>
  );
}
