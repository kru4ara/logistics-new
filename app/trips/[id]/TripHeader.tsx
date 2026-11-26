'use client';

import Link from 'next/link';
import { Pencil, Trash2, FileText, ArrowLeft } from 'lucide-react';
import TripStatusButtons from '../../driver/TripStatusButtons';
import SyncLogisatButton from './SyncLogisatButton';
import MoreMenu, { menuItemClass } from '../../components/MoreMenu';
import ConfirmSubmit from '../../components/ConfirmSubmit';
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
  invoiceForm = false,
  readOnly = false,
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
  /** в заказе есть форма фактуры — «Выставить счёт» ведёт к ней */
  invoiceForm?: boolean;
  /** только просмотр (бухгалтер): без смены статуса, правки, удаления и телеметрии */
  readOnly?: boolean;
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

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
            <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={true} invoiceForm={invoiceForm} compact />
            <div className="flex items-center gap-2 ml-auto">
              <Link href={`/trips/${tripId}/edit`} className="btn btn-secondary text-sm">
                <Pencil className="w-4 h-4" strokeWidth={2} />
                {t('trip.edit')}
              </Link>
              <MoreMenu label={t('trip.moreActions')}>
                <SyncLogisatButton
                  tripId={tripId}
                  disabled={!trip.trip_number}
                  disabledHint={t('trip.logisatNeedTruck')}
                  className={menuItemClass}
                />
                <form action={deleteTrip.bind(null, tripId)}>
                  <ConfirmSubmit
                    message={t('trip.deleteConfirm', { n: String(trip.trip_number ?? '—') })}
                    className={`${menuItemClass} text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                    {t('trip.delete')}
                  </ConfirmSubmit>
                </form>
              </MoreMenu>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
