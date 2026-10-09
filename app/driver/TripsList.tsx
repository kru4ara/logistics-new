'use client';

import { useState } from 'react';
import {
  Route as RouteIcon,
  MapPin,
  Flag,
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type ConsolidationPoint = {
  country: string | null;
  city: string | null;
  company: string | null;
  postal_code: string | null;
  address: string | null;
};

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return (rel[0] as any)?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

const statusStripColors: Record<string, string> = {
  planned: 'bg-slate-300',
  active: 'bg-brand-500',
  completed: 'bg-green-500',
  invoiced: 'bg-yellow-500',
  paid: 'bg-emerald-500',
};

export default function TripsList({
  trips,
  consolidationByTrip,
  initialVisible = 5,
}: {
  trips: any[];
  consolidationByTrip: Record<string, ConsolidationPoint>;
  initialVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  if (trips.length === 0) {
    return null;
  }

  const visibleTrips = showAll ? trips : trips.slice(0, initialVisible);
  const hiddenCount = Math.max(0, trips.length - initialVisible);

  return (
    <div className="space-y-4">
      {visibleTrips.map((trip) => {
        const clientName = pickName(trip.clients) || 'Клиент не указан';
        const consolidation = consolidationByTrip[trip.id];

        const loadCity = consolidation?.city || trip.sender_city;
        const loadCountry = consolidation?.country || trip.sender_country;
        const loadLabel = consolidation ? 'Загрузка (после подрядчика)' : 'Загрузка';

        return (
          <a
            key={trip.id}
            href={`/driver/trips/${trip.id}`}
            className="group card card-hover overflow-hidden active:scale-[0.99]"
          >
            <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400 font-medium tabular-nums">
                    Рейс № {trip.trip_number || '—'}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 break-words group-hover:text-brand-600 transition-colors">
                    {clientName}
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                  ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {statusLabels[trip.status] || trip.status}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
                <div className="flex items-start gap-2 text-slate-800 font-semibold text-sm">
                  <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                  <span className="break-words">{trip.route || '—'}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {(loadCity || loadCountry) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 font-medium">{loadLabel}</div>
                      <div className="text-slate-700 break-words">
                        {[loadCity, loadCountry].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                {trip.receiver_city && (
                  <div className="flex items-start gap-2">
                    <Flag className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 font-medium">Выгрузка</div>
                      <div className="text-slate-700 break-words">
                        {trip.receiver_city}, {trip.receiver_country}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                  {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                </span>
                <span className="text-brand-600 font-semibold text-sm inline-flex items-center gap-1
                                 group-hover:gap-1.5 transition-all">
                  Открыть
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </a>
        );
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600
                     font-medium text-sm hover:bg-white hover:border-brand-300 hover:text-brand-600
                     transition-all active:scale-[0.99]
                     inline-flex items-center justify-center gap-2"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
              Свернуть
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
              Показать все рейсы ({trips.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}
