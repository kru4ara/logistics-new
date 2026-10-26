'use client';

import Link from 'next/link';
import { Pencil, Trash2, FileText, ArrowLeft } from 'lucide-react';
import TripStatusButtons from '../../driver/TripStatusButtons';
import SyncLogisatButton from './SyncLogisatButton';
import SubmitButton from '../../components/SubmitButton';
import { saveTelemetry } from '../../telemetry-actions'; // <-- импорт
import { deleteTrip } from '../../trip-actions';

export default function TripHeader({
  tripId,
  trip,
  driver,
  trailerNumber,
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
  // Создаём Server Action с привязкой tripId
  async function handleSaveTelemetry(formData: FormData) {
    'use server';
    const km = parseFloat(formData.get('km') as string) || 0;
    const liters = parseFloat(formData.get('liters') as string) || 0;
    await saveTelemetry(tripId, km, liters);
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Все рейсы
      </Link>

      <div className="card p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 font-medium">Рейс</div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">
              № {trip.trip_number || '—'}
            </h1>
            <div className="text-sm text-slate-500 mt-1">
              {trip.clients?.name || 'Клиент не указан'}
            </div>
            {trip.client_request_number && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 flex-wrap">
                <FileText className="w-4 h-4 shrink-0 text-slate-400" strokeWidth={2} />
                <span>Заявка № <b className="text-slate-700">{trip.client_request_number}</b></span>
                {trip.client_request_date && (
                  <span className="text-slate-400 ml-1">
                    от {new Date(trip.client_request_date).toLocaleDateString('ru-RU')}
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
            Редактировать
          </Link>
          <SyncLogisatButton
            tripId={tripId}
            disabled={!trip.trip_number}
            disabledHint="Сначала назначьте транспорт (участок «Наша машина»)"
          />
          <form action={deleteTrip.bind(null, tripId)} className="flex-1 sm:flex-none">
            <button type="submit" className="btn btn-danger text-sm w-full">
              <Trash2 className="w-4 h-4" strokeWidth={2} />
              Удалить
            </button>
          </form>
        </div>

        {/* ТЕЛЕМЕТРИЯ (Перенесена сюда) */}
        <div className="bg-slate-50 rounded-xl p-3 md:p-4 mb-4">
          <form action={handleSaveTelemetry} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Пробег (км)</label>
              <input type="number" name="km" step="0.01" placeholder={trip.actual_km?.toString() || '0'} className="input py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Топливо (л)</label>
              <input type="number" name="liters" step="0.01" placeholder={trip.actual_liters?.toString() || '0'} className="input py-1.5 text-sm" />
            </div>
            <SubmitButton
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all"
              pendingText="…"
            >
              Сохранить
            </SubmitButton>
          </form>
          {trip.actual_km && trip.actual_km > 0 && (
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
              <span>Текущие: <b className="tabular-nums">{trip.actual_km} км / {trip.actual_liters} л</b></span>
              <span className={`font-bold ${fuelLeftIsCritical ? 'text-red-600' : fuelLeftIsNegative ? 'text-amber-600' : 'text-brand-600'}`}>
                (Остаток: {fuelLeft.toFixed(1)} л)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
