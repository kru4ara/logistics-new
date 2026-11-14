'use client';

import Link from 'next/link';
import { Pencil, Trash2, FileText, ArrowLeft } from 'lucide-react';
import TripStatusButtons from '../../driver/TripStatusButtons';
import SyncLogisatButton from './SyncLogisatButton';
import SubmitButton from '../../components/SubmitButton';
import { handleSaveTelemetry } from '../../telemetry-actions';
import { deleteTrip } from '../../trip-actions';
import { useT } from '../../components/I18nProvider';
import { formatDate } from '../../../lib/i18n/format';

export default function TripHeader({
  tripId,
  trip,
  fuelLeft,
  fuelLeftIsNegative,
  fuelLeftIsCritical,
  statusLabels,
  statusColors,
}: {
  tripId: string;
  trip: any;
  driver: any;
  trailerNumber: string | null;
  fuelLeft: number;
  fuelLeftIsNegative: boolean;
  fuelLeftIsCritical: boolean;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}) {
  const { t, locale } = useT();
  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        {t('trip.allTrips')}
      </Link>

      <div className="card p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 font-medium">{t('trip.trip')}</div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">
              № {trip.trip_number || '—'}
            </h1>
            <div className="text-sm text-slate-500 mt-1">
              {trip.clients?.name || t('trip.noClient')}
            </div>
            {trip.client_request_number && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 flex-wrap">
                <FileText className="w-4 h-4 shrink-0 text-slate-400" strokeWidth={2} />
                <span>{t('trip.requestNo')} <b className="text-slate-700">{trip.client_request_number}</b></span>
                {trip.client_request_date && (
                  <span className="text-slate-400 ml-1">
                    {t('trip.from', { date: formatDate(trip.client_request_date, locale) })}
                  </span>
                )}
              </div>
            )}
          </div>
          <span className={`self-start px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                            ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {statusLabels[trip.status] || trip.status}
          </span>
        </div>

        {/* ДЕЙСТВИЯ ПО РЕЙСУ (сжатые) */}
        <div className="mb-4 pb-4 border-b border-slate-100">
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={true} />
        </div>

        {/* КНОПКИ РЕДАКТИРОВАНИЯ */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={`/trips/${tripId}/edit`}
            className="btn btn-secondary text-sm flex-1 sm:flex-none"
          >
            <Pencil className="w-4 h-4" strokeWidth={2} />
            {t('trip.edit')}
          </Link>
          <SyncLogisatButton
            tripId={tripId}
            disabled={!trip.trip_number}
            disabledHint={t('trip.logisatNeedTruck')}
          />
          <form action={deleteTrip.bind(null, tripId)} className="flex-1 sm:flex-none">
            <button type="submit" className="btn btn-danger text-sm w-full">
              <Trash2 className="w-4 h-4" strokeWidth={2} />
              {t('trip.delete')}
            </button>
          </form>
        </div>

        {/* ТЕЛЕМЕТРИЯ */}
        <div className="bg-slate-50 rounded-xl p-3 md:p-4 mb-4">
          <form action={handleSaveTelemetry.bind(null, tripId)} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('trip.mileageKm')}</label>
              <input type="number" name="km" step="0.01" placeholder={trip.actual_km?.toString() || '0'} className="input py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('trip.fuelL')}</label>
              <input type="number" name="liters" step="0.01" placeholder={trip.actual_liters?.toString() || '0'} className="input py-1.5 text-sm" />
            </div>
            <SubmitButton
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all"
              pendingText="…"
            >
              {t('common.save')}
            </SubmitButton>
          </form>
          {trip.actual_km && trip.actual_km > 0 && (
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
              <span>{t('trip.current')} <b className="tabular-nums">{trip.actual_km} {t('units.km')} / {trip.actual_liters} {t('units.l')}</b></span>
              <span className={`font-bold ${fuelLeftIsCritical ? 'text-red-600' : fuelLeftIsNegative ? 'text-amber-600' : 'text-brand-600'}`}>
                {t('trip.fuelLeft', { n: fuelLeft.toFixed(1) })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
