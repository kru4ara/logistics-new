import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { scopedClient } from '../../lib/supabase/scoped';
import { buildRouteMap } from '../../lib/trip-route';
import MapView from './MapViewWrapper';
import { getScope, applyTripScope } from '../../lib/scope';
import {
  Map as MapIcon,
  MapPin,
  Package,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import { fetchAll, fetchAllByIds } from '../../lib/fetch-all';
import { deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const { t: tr } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'map.view');
  if (denied) redirect(denied);

  const scoped = await scopedClient();

  const scope = await getScope();

  const { data: tripsRaw, error } = await fetchAll(applyTripScope(
      scoped
        .from('trips')
        .select('id, trip_number, status, start_lat, start_lng, end_lat, end_lng, start_date'),
      scope
    )
    .not('start_lat', 'is', null)
    .not('start_lng', 'is', null));

  if (error) {
    return <div className="p-8 text-red-500">{tr('today.tripsLoadError')}{' '}{error.message}</div>;
  }

  // Маршрут и точки — из сегментов
  const tripIds = (tripsRaw || []).map((t: any) => t.id);
  const { data: segs } = tripIds.length > 0
    ? await fetchAllByIds(tripIds, (chunk) => scoped
        .from('trip_segments')
        .select('trip_id, position, from_city, from_country, to_city, to_country')
        .in('trip_id', chunk))
    : { data: [] };

  const routeMap = buildRouteMap(segs || []);

  const trips = (tripsRaw || []).map((t: any) => {
    const r = routeMap.get(t.id);
    return {
      ...t,
      route: r?.route || null,
      from_city: r?.from_city || null,
      from_country: r?.from_country || null,
      to_city: r?.to_city || null,
      to_country: r?.to_country || null,
    };
  });

  const withBoth = trips.filter(
    (t) => t.start_lat && t.start_lng && t.end_lat && t.end_lng
  );

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const statusLabels: Record<string, string> = {
    planned: tr('status.planned'),
    active: tr('status.active'),
    completed: tr('status.completed'),
    invoiced: tr('status.invoiced'),
    paid: tr('status.paid'),
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <MapIcon className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {tr('mapx.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              {tr('seg.optLoad')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              {tr('seg.optUnload')}
            </span>
            <span className="text-slate-400">·</span>
            <span>{tr('mapx.line')}</span>
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {tr('mapx.points')}
            </h2>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                {tr('mapx.pointsC')}{' '}<b className="text-green-700 tabular-nums">{trips?.length || 0}</b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                {tr('mapx.routesC')}{' '}<b className="text-red-600 tabular-nums">{withBoth.length}</b>
              </span>
            </div>
          </div>
          <div style={{ height: '600px' }}>
            <MapView trips={trips || []} />
          </div>
        </div>

        {trips && trips.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-600" strokeWidth={2} />
              <h2 className="text-lg font-bold text-slate-900">{tr('mapx.tripsOnMap')}</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold tabular-nums">
                {trips.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {trips.map((trip) => (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4
                             hover:bg-brand-50/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">
                        № {trip.trip_number || '—'} · {trip.route || '—'}
                      </div>
                      <div className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="truncate">{trip.from_city || '—'}, {trip.from_country || '—'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{trip.to_city || '—'}, {trip.to_country || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                      ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500
                                            group-hover:translate-x-0.5 transition-all" strokeWidth={2.5} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {trips && trips.length === 0 && (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{tr('mapx.noPoints')}</h2>
            <p className="text-slate-500">{tr('mapx.noCoords')}</p>
          </div>
        )}

      </div>
    </main>
  );
}
