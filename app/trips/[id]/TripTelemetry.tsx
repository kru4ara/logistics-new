import { Gauge } from 'lucide-react';
import SubmitButton from '../../components/SubmitButton';
import { handleSaveTelemetry } from '../../telemetry-actions';
import { getT } from '../../../lib/i18n/server';
import { formatNumber } from '../../../lib/i18n/format';

/** Пробег и топливо рейса вручную (если GPS не дал данных) — вкладка «Расходы». */
export default async function TripTelemetry({
  tripId,
  actualKm,
  actualLiters,
  fuelLeft,
  fuelLeftIsNegative,
  fuelLeftIsCritical,
}: {
  tripId: string;
  actualKm: number | null;
  actualLiters: number | null;
  fuelLeft: number;
  fuelLeftIsNegative: boolean;
  fuelLeftIsCritical: boolean;
}) {
  const { t } = await getT();
  return (
    <section className="card p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-5 h-5 text-brand-600" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-900">{t('trip.telemetryTitle')}</h2>
        {actualKm != null && actualKm > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {t('trip.current')} <b className="tabular-nums">{formatNumber(actualKm)} {t('units.km')} / {formatNumber(actualLiters, 'auto')} {t('units.l')}</b>
            {' · '}
            <b className={fuelLeftIsCritical ? 'text-red-600' : fuelLeftIsNegative ? 'text-amber-600' : 'text-brand-600'}>
              {t('trip.fuelLeft', { n: fuelLeft.toFixed(1) })}
            </b>
          </span>
        )}
      </div>
      <form action={handleSaveTelemetry.bind(null, tripId)} className="flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-[120px] text-xs font-medium text-slate-500">
          {t('trip.mileageKm')}
          <input type="number" name="km" step="0.01" placeholder={actualKm?.toString() || '0'} className="input mt-1 py-1.5 text-sm" />
        </label>
        <label className="flex-1 min-w-[120px] text-xs font-medium text-slate-500">
          {t('trip.fuelL')}
          <input type="number" name="liters" step="0.01" placeholder={actualLiters?.toString() || '0'} className="input mt-1 py-1.5 text-sm" />
        </label>
        <SubmitButton className="btn btn-secondary text-sm w-full sm:w-auto" pendingText="…">
          {t('common.save')}
        </SubmitButton>
      </form>
    </section>
  );
}
