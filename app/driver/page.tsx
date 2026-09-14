import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function DriverPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;
  const userName = cookieStore.get('user_name')?.value
    ? decodeURIComponent(cookieStore.get('user_name')!.value)
    : 'Водитель';

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('driver_id', driverId)
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-6 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
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
    active: 'bg-blue-500',
    completed: 'bg-green-500',
    invoiced: 'bg-yellow-500',
    paid: 'bg-emerald-500',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        {/* Приветствие */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white">
          <div className="text-sm text-blue-200">Привет,</div>
          <div className="text-2xl font-bold mt-1">{userName} 👋</div>
          <div className="text-sm text-blue-200 mt-3">
            Назначено рейсов: <span className="font-bold text-white">{trips?.length || 0}</span>
          </div>
        </div>

        {/* Список рейсов */}
        {trips?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Рейсов пока нет</h2>
            <p className="text-slate-500 text-sm">Ожидайте заданий от офиса</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips?.map((trip) => (
              <a
                key={trip.id}
                href={`/driver/trips/${trip.id}`}
                className="block bg-white rounded-2xl border border-slate-100 shadow-sm
                           hover:shadow-lg hover:border-blue-200 transition-all overflow-hidden active:scale-[0.99]"
              >
                {/* Цветная полоса статуса */}
                <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

                <div className="p-5">
                  {/* Номер и статус */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">
                        Рейс № {trip.trip_number || '—'}
                      </div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        {trip.clients?.name || 'Клиент не указан'}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                      ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>

                  {/* Маршрут */}
                  <div className="bg-slate-50 rounded-xl p-3 mb-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                      <span>🛣</span>
                      <span>{trip.route || '—'}</span>
                    </div>
                  </div>

                  {/* Загрузка / Выгрузка */}
                  <div className="space-y-2 text-sm">
                    {trip.sender_city && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">📍</span>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 font-medium">Загрузка</div>
                          <div className="text-slate-700 truncate">
                            {trip.sender_city}, {trip.sender_country}
                          </div>
                        </div>
                      </div>
                    )}
                    {trip.receiver_city && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">🏁</span>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 font-medium">Выгрузка</div>
                          <div className="text-slate-700 truncate">
                            {trip.receiver_city}, {trip.receiver_country}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Дата */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      📅 {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <span className="text-blue-600 font-semibold text-sm">
                      Открыть →
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
