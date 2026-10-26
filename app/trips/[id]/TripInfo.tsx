import {
  Route as RouteIcon,
  Truck,
  UserCircle,
  Phone,
} from 'lucide-react';
import RecalcCoordsButton from './RecalcCoordsButton';

export default function TripInfo({
  tripId,
  trip,
  driver,
  truck,
  trailerNumber,
  computedRoute,
}: {
  tripId: string;
  trip: any;
  driver: any;
  truck: any;
  trailerNumber: string | null;
  computedRoute: string;
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="col-span-2">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
          <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
            <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
            <span className="break-words">{computedRoute}</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тягач / Прицеп</div>
          <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
            <Truck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
            <span className="break-words">
              {truck?.registration_number || '—'}
              {trailerNumber && ` / ${trailerNumber}`}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Водитель</div>
          <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
            <UserCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
            <span className="break-words">
              {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
            </span>
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефоны</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-800 font-medium text-sm">
            {driver?.phone_by ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="text-xs font-semibold text-slate-400">BY</span>
                <a href={`tel:${driver.phone_by}`} className="hover:text-brand-600 tabular-nums">
                  {driver.phone_by}
                </a>
              </span>
            ) : null}
            {driver?.phone_pl ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="text-xs font-semibold text-slate-400">PL</span>
                <a href={`tel:${driver.phone_pl}`} className="hover:text-brand-600 tabular-nums">
                  {driver.phone_pl}
                </a>
              </span>
            ) : null}
            {!driver?.phone_by && !driver?.phone_pl && (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-4 pt-4 border-t border-slate-100">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
          <div className="text-lg md:text-xl font-bold text-green-600 break-words tabular-nums">
            {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Топливо</div>
          <div className="text-lg md:text-xl font-bold text-brand-600 tabular-nums">
            {trip.start_fuel_level || 0} л
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Старт</div>
          <div className="text-lg md:text-xl font-bold text-slate-800 tabular-nums">
            {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Финиш</div>
          <div className={`text-lg md:text-xl font-bold tabular-nums ${trip.end_date ? 'text-emerald-600' : 'text-slate-400'}`}>
            {trip.end_date ? new Date(trip.end_date).toLocaleDateString('ru-RU') : '—'}
          </div>
        </div>
      </div>

      {(trip.start_odometer || trip.end_odometer || trip.actual_km) && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mt-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Одометр старта</div>
            <div className="text-lg md:text-xl font-bold text-slate-700 tabular-nums">
              {trip.start_odometer ? `${trip.start_odometer} км` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Одометр финиша</div>
            <div className="text-lg md:text-xl font-bold text-slate-700 tabular-nums">
              {trip.end_odometer ? `${trip.end_odometer} км` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Пробег за рейс</div>
            <div className="text-lg md:text-xl font-bold text-emerald-600 tabular-nums">
              {trip.actual_km ? `${trip.actual_km} км` : '—'}
            </div>
          </div>
        </div>
      )}

      {trip.logisat_synced_at && (
        <div className="text-xs text-slate-400 mt-3 text-right">
          Logisat синхронизирован: {new Date(trip.logisat_synced_at).toLocaleString('ru-RU')}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          {trip.start_lat && trip.start_lng ? 'Координаты есть' : 'Координаты не заполнены'}
        </div>
        <RecalcCoordsButton tripId={tripId} />
      </div>
    </div>
  );
}
