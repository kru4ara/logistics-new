import Link from 'next/link';
import { Route as RouteIcon } from 'lucide-react';

export default function DriverTrips({
  lastTrips,
  totalTrips,
  routeByTrip,
  statusLabels,
  statusColors,
}: {
  lastTrips: any[];
  totalTrips: number;
  routeByTrip: Map<string, string>;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}) {
  if (lastTrips.length === 0) return null;

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Последние рейсы
        </h2>
        {totalTrips > 5 && (
          <span className="text-xs text-slate-400">
            показано 5 из {totalTrips}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {lastTrips.map((t) => {
          const clientName = t.clients?.name || '—';
          const dateStr = t.end_date || t.start_date;
          const routeDisplay = routeByTrip.get(t.id) || '—';
          return (
            <Link
              key={t.id}
              href={`/trips/${t.id}`}
              className="block border border-slate-100 rounded-xl p-3 md:p-4 bg-slate-50/40
                         hover:bg-brand-50/40 hover:border-brand-200 transition-all"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-slate-400 tabular-nums">
                      № {t.trip_number || '—'}
                    </span>
                    <span className={`text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap
                                      ${statusColors[t.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                    {dateStr && (
                      <span className="text-xs text-slate-500 tabular-nums">
                        · {new Date(dateStr).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 break-words">
                    {clientName}
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-0.5">
                    <RouteIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="break-words">{routeDisplay}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-green-600 whitespace-nowrap tabular-nums">
                    {t.revenue_eur ? `${t.revenue_eur} €` : '—'}
                  </div>
                  {t.actual_km && (
                    <div className="text-xs text-slate-400 tabular-nums">
                      {Math.round(t.actual_km)} км
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
