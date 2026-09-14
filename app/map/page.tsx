import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

const MapView = dynamicImport(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
      Загрузка карты...
    </div>
  ),
});

export default async function MapPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, trip_number, route, status, start_lat, start_lng, start_date')
    .not('start_lat', 'is', null)
    .not('start_lng', 'is', null)
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700',
    active: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    invoiced: 'bg-yellow-50 text-yellow-700',
    paid: 'bg-emerald-50 text-emerald-700',
  };

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div>
          <h1 className="text-3xl font-bold text-slate-900">🗺 Карта рейсов</h1>
          <p className="text-slate-500 mt-1">На карте отображены точки загрузки активных и завершённых рейсов</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Точки маршрутов</h2>
            <span className="text-sm text-slate-500">
              Отмечено: <b className="text-blue-600">{trips?.length || 0}</b>
            </span>
          </div>
          <div style={{ height: '600px' }}>
            <MapView trips={trips || []} />
          </div>
        </div>

        {trips && trips.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Рейсы на карте</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {trips.map((trip) => (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4
                             hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg shrink-0">
                      📍
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">
                        № {trip.trip_number || '—'} · {trip.route || '—'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                        {' · '}
                        {trip.start_lat?.toFixed(4)}, {trip.start_lng?.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap
                                    ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                    {statusLabels[trip.status] || trip.status}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {trips && trips.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">🗺</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Точек на карте нет</h2>
            <p className="text-slate-500">У рейсов не заполнены координаты (start_lat, start_lng)</p>
          </div>
        )}

      </div>
    </main>
  );
}
