import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import DownloadButton from './DownloadButton';

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name), drivers(first_name, last_name)')
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок и кнопки */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📋 Рейсы</h1>
            <p className="text-slate-500 mt-1">Всего рейсов: {trips?.length || 0}</p>
          </div>
          <div className="flex gap-3">
            <DownloadButton data={trips || []} />
            <a
              href="/trips/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                         transition-all duration-150 active:scale-[0.98]"
            >
              <span>➕</span>
              <span>Создать рейс</span>
            </a>
          </div>
        </div>

        {/* Сетка рейсов */}
        {trips?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Рейсов пока нет</h2>
            <p className="text-slate-500 mb-6">Создайте первый рейс, чтобы начать работу</p>
            <a
              href="/trips/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-6 py-3 rounded-xl transition-all"
            >
              ➕ Создать рейс
            </a>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trips?.map((trip) => {
              const tripExpenses = expensesByTrip[trip.id] || 0;
              const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
              const driver = trip.drivers;

              return (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                             hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5
                             transition-all duration-200 overflow-hidden"
                >
                  {/* Верхняя полоса статуса */}
                  <div className={`h-1.5 ${
                    trip.status === 'paid' ? 'bg-emerald-500' :
                    trip.status === 'completed' ? 'bg-green-500' :
                    trip.status === 'active' ? 'bg-blue-500' :
                    trip.status === 'invoiced' ? 'bg-yellow-500' :
                    'bg-slate-300'
                  }`} />

                  <div className="p-5">
                    {/* Заголовок с номером и статусом */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs text-slate-400 font-medium">
                          № {trip.trip_number || '—'}
                        </div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5 group-hover:text-blue-600 transition-colors">
                          {trip.clients?.name || 'Не указан'}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                        ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusLabels[trip.status] || trip.status}
                      </span>
                    </div>

                    {/* Маршрут */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <span>🛣</span>
                      <span className="truncate">{trip.route || '—'}</span>
                    </div>

                    {/* Дата и водитель */}
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                      <span>
                        📅 {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                      </span>
                      {driver && (
                        <span className="truncate">
                          🚛 {driver.first_name} {driver.last_name}
                        </span>
                      )}
                    </div>

                    {/* Финансы */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Фрахт</div>
                        <div className="text-sm font-bold text-slate-900">
                          {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Расходы</div>
                        <div className="text-sm font-bold text-red-500">
                          {tripExpenses.toFixed(0)} €
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Прибыль</div>
                        <div className={`text-sm font-bold ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tripProfit.toFixed(0)} €
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
