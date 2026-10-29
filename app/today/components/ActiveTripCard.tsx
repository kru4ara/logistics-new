import Link from 'next/link';
import { Route as RouteIcon, Truck, UserCircle } from 'lucide-react';
import { fmtDateRu } from '../lib/dates';

export type ActiveTrip = {
  id: string;
  trip_number: string | null;
  route?: string | null;
  start_date?: string | null;
  clientName?: string | null;
  driverName?: string | null;
  truckNumber?: string | null;
};

/** Карточка активного рейса в блоке «В пути сейчас». */
export default function ActiveTripCard({ trip }: { trip: ActiveTrip }) {
  const clientName = trip.clientName || '—';
  const driverName = trip.driverName;
  const truckNumber = trip.truckNumber;
  return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="group card card-hover overflow-hidden active:scale-[0.99]"
                  >
                    <div className="h-1.5 bg-brand-500" />
                    <div className="p-4">
                      <div className="text-xs text-slate-400 font-medium tabular-nums mb-1">
                        № {trip.trip_number || '—'}
                      </div>
                      <div className="font-bold text-slate-900 text-sm break-words group-hover:text-brand-600 transition-colors mb-2">
                        {clientName}
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-3">
                        <RouteIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
                        <span className="break-words">{trip.route || '—'}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-slate-100 text-xs text-slate-500">
                        {truckNumber && (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" strokeWidth={2} />
                            <b className="text-slate-700">{truckNumber}</b>
                          </span>
                        )}
                        {driverName && (
                          <span className="inline-flex items-center gap-1">
                            <UserCircle className="w-3 h-3" strokeWidth={2} />
                            {driverName}
                          </span>
                        )}
                        {trip.start_date && (
                          <span className="inline-flex items-center gap-1 ml-auto tabular-nums">
                            {fmtDateRu(trip.start_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                
  );
}
