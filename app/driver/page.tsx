import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

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

  const supabase = await createClient();

  // Все рейсы водителя
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('driver_id', driverId)
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-6 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  // Зарплата водителя
  const tripIds = trips?.map((t) => t.id) || [];
  let salaryTotal = 0;
  if (tripIds.length > 0) {
    const { data: salaryExpenses } = await supabase
      .from('trip_expenses')
      .select('amount_eur, expense_date, trip_id')
      .eq('category', 'salary')
      .in('trip_id', tripIds);
    salaryTotal = salaryExpenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  }

  // Текущий месяц
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTrips = trips?.filter((t) => {
    if (!t.start_date) return false;
    const d = new Date(t.start_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthKm = monthTrips.reduce((sum, t) => sum + (t.actual_km || 0), 0);
  const monthLiters = monthTrips.reduce((sum, t) => sum + (t.actual_liters || 0), 0);

  // Зарплата за текущий месяц
  let monthSalary = 0;
  if (monthTrips.length > 0) {
    const monthTripIds = monthTrips.map((t) => t.id);
    const { data: monthSalaryExp } = await supabase
      .from('trip_expenses')
      .select('amount_eur')
      .eq('category', 'salary')
      .in('trip_id', monthTripIds);
    monthSalary = monthSalaryExp?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  }

  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

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
            Всего рейсов: <span className="font-bold text-white">{trips?.length || 0}</span>
          </div>
        </div>

        {/* Статистика за месяц */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            📊 {monthName}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Рейсов за месяц</div>
              <div className="text-2xl font-bold text-blue-600">{monthTrips.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Зарплата за месяц</div>
              <div className="text-2xl font-bold text-emerald-600">{monthSalary.toFixed(0)} €</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Пройдено км</div>
              <div className="text-2xl font-bold text-slate-800">{monthKm.toFixed(0)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Израсходовано топлива</div>
              <div className="text-2xl font-bold text-slate-800">{monthLiters.toFixed(0)} л</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2 px-1">
            Зарплата за всё время: <b className="text-slate-600">{salaryTotal.toFixed(0)} €</b>
          </div>
        </div>

        {/* Список рейсов */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            🚚 Все рейсы
          </h2>
          {trips?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <div className="text-5xl mb-3">📭</div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Рейсов пока нет</h2>
              <p className="text-slate-500 text-sm">Ожидайте заданий от офиса</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trips?.map((trip) => {
                const clientName = pickName(trip.clients) || 'Клиент не указан';
                return (
                  <a
                    key={trip.id}
                    href={`/driver/trips/${trip.id}`}
                    className="block bg-white rounded-2xl border border-slate-100 shadow-sm
                               hover:shadow-lg hover:border-blue-200 transition-all overflow-hidden active:scale-[0.99]"
                  >
                    <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-xs text-slate-400 font-medium">
                            Рейс № {trip.trip_number || '—'}
                          </div>
                          <div className="text-lg font-bold text-slate-900 mt-0.5">
                            {clientName}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                          ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3 mb-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                          <span>🛣</span>
                          <span>{trip.route || '—'}</span>
                        </div>
                      </div>

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
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
