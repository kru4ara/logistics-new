import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function DriverKpiPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  // Все водители
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*')
    .order('last_name', { ascending: true });

  if (driversError) {
    return <div className="p-8 text-red-500">Ошибка загрузки водителей: {driversError.message}</div>;
  }

  // Все рейсы
  const { data: trips } = await supabase
    .from('trips')
    .select('id, driver_id, revenue_eur, actual_km, actual_liters, start_date, status');

  // Все зарплаты
  const { data: salaryExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur')
    .eq('category', 'salary');

  // Карта рейс → зарплата
  const salaryByTrip: Record<string, number> = {};
  salaryExpenses?.forEach((e) => {
    if (!e.trip_id) return;
    salaryByTrip[e.trip_id] = (salaryByTrip[e.trip_id] || 0) + (e.amount_eur || 0);
  });

  // Текущий месяц
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  // Считаем метрики по каждому водителю
  const kpi = drivers?.map((driver) => {
    const driverTrips = trips?.filter((t) => t.driver_id === driver.id) || [];

    const monthTrips = driverTrips.filter((t) => {
      if (!t.start_date) return false;
      const d = new Date(t.start_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalTrips = driverTrips.length;
    const monthTripsCount = monthTrips.length;

    // Зарплата: считаем только по завершённым рейсам
    const salaryTotal = driverTrips.reduce((sum, t) => sum + (salaryByTrip[t.id] || 0), 0);
    const salaryMonth = monthTrips.reduce((sum, t) => sum + (salaryByTrip[t.id] || 0), 0);

    // Пробег и топливо (только где есть данные)
    const totalKm = driverTrips.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLiters = driverTrips.reduce((sum, t) => sum + (t.actual_liters || 0), 0);

    // Средний расход л/100км (только рейсы с обоими полями)
    const tripsWithFuel = driverTrips.filter(
      (t) => t.actual_km && t.actual_km > 0 && t.actual_liters
    );
    const totalKmForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLitersForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_liters || 0), 0);
    const avgConsumption = totalKmForFuel > 0 ? (totalLitersForFuel / totalKmForFuel) * 100 : null;

    // Фрахт по рейсам водителя
    const totalRevenue = driverTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);

    // Средний фрахт за рейс
    const avgRevenue = totalTrips > 0 ? totalRevenue / totalTrips : 0;

    return {
      driver,
      totalTrips,
      monthTripsCount,
      salaryTotal,
      salaryMonth,
      totalKm,
      totalLiters,
      avgConsumption,
      totalRevenue,
      avgRevenue,
    };
  }) || [];

  // Сортируем по количеству рейсов за месяц (убывание)
  const sortedKpi = [...kpi].sort((a, b) => b.monthTripsCount - a.monthTripsCount);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Назад */}
        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все водители
        </a>

        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📊 KPI водителей</h1>
          <p className="text-slate-500 mt-1">Показатели работы за {monthName} и за всё время</p>
        </div>

        {/* Таблица KPI */}
        {sortedKpi.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Водителей пока нет</h2>
            <p className="text-slate-500">Добавьте водителей, чтобы увидеть статистику</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Водитель</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов<br/><span className="text-[10px] font-normal text-slate-400 normal-case">мес / всего</span></th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ЗП мес</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ЗП всего</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пробег</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Топливо</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расход</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedKpi.map((item, idx) => {
                    const initials = `${item.driver.first_name?.[0] || ''}${item.driver.last_name?.[0] || ''}`.toUpperCase();
                    const consumptionColor =
                      item.avgConsumption === null ? 'text-slate-400' :
                      item.avgConsumption > 35 ? 'text-red-500' :
                      item.avgConsumption > 30 ? 'text-orange-500' :
                      'text-emerald-600';

                    return (
                      <tr
                        key={item.driver.id}
                        className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {initials || '👤'}
                            </div>
                            <div className="min-w-0">
                              <a
                                href={`/drivers/${item.driver.id}`}
                                className="font-semibold text-slate-800 hover:text-blue-600 transition-colors block truncate"
                              >
                                {item.driver.first_name} {item.driver.last_name}
                              </a>
                              <div className="text-xs text-slate-400 truncate">{item.driver.phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-lg font-bold text-blue-600">{item.monthTripsCount}</span>
                            <span className="text-xs text-slate-400">/ {item.totalTrips}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-emerald-600">
                          {item.salaryMonth.toFixed(0)} €
                        </td>
                        <td className="px-4 py-4 text-right text-slate-600">
                          {item.salaryTotal.toFixed(0)} €
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700">
                          {item.totalKm > 0 ? `${item.totalKm.toFixed(0)} км` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700">
                          {item.totalLiters > 0 ? `${item.totalLiters.toFixed(0)} л` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold ${consumptionColor}`}>
                          {item.avgConsumption !== null ? `${item.avgConsumption.toFixed(1)} л/100км` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-green-600">
                          {item.totalRevenue.toFixed(0)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Пояснение */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
              <b>Расход</b> считается только по рейсам, где есть и пробег, и литры.
              {' · '}
              <span className="text-emerald-600">Зелёный</span> = норма, <span className="text-orange-500">оранжевый</span> = выше 30, <span className="text-red-500">красный</span> = выше 35.
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
