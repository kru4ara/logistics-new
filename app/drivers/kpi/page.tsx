import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function DriverKpiPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*')
    .order('last_name', { ascending: true });

  if (driversError) {
    return <div className="p-8 text-red-500">Ошибка загрузки водителей: {driversError.message}</div>;
  }

  const { data: trips } = await supabase
    .from('trips')
    .select('id, driver_id, revenue_eur, actual_km, actual_liters, start_date, status');

  const { data: salaryExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur')
    .eq('category', 'salary');

  const salaryByTrip: Record<string, number> = {};
  salaryExpenses?.forEach((e) => {
    if (!e.trip_id) return;
    salaryByTrip[e.trip_id] = (salaryByTrip[e.trip_id] || 0) + (e.amount_eur || 0);
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const kpi = drivers?.map((driver) => {
    const driverTrips = trips?.filter((t) => t.driver_id === driver.id) || [];

    const monthTrips = driverTrips.filter((t) => {
      if (!t.start_date) return false;
      const d = new Date(t.start_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalTrips = driverTrips.length;
    const monthTripsCount = monthTrips.length;

    const salaryTotal = driverTrips.reduce((sum, t) => sum + (salaryByTrip[t.id] || 0), 0);
    const salaryMonth = monthTrips.reduce((sum, t) => sum + (salaryByTrip[t.id] || 0), 0);

    const totalKm = driverTrips.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLiters = driverTrips.reduce((sum, t) => sum + (t.actual_liters || 0), 0);

    const tripsWithFuel = driverTrips.filter(
      (t) => t.actual_km && t.actual_km > 0 && t.actual_liters
    );
    const totalKmForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLitersForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_liters || 0), 0);
    const avgConsumption = totalKmForFuel > 0 ? (totalLitersForFuel / totalKmForFuel) * 100 : null;

    const totalRevenue = driverTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
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

  const sortedKpi = [...kpi].sort((a, b) => b.monthTripsCount - a.monthTripsCount);

  function consumptionColor(c: number | null): string {
    if (c === null) return 'text-slate-400';
    if (c > 35) return 'text-red-500';
    if (c > 30) return 'text-orange-500';
    return 'text-emerald-600';
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все водители
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📊 KPI водителей</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">За {monthName} и за всё время</p>
        </div>

        {sortedKpi.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-5xl md:text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Водителей пока нет</h2>
            <p className="text-slate-500">Добавьте водителей, чтобы увидеть статистику</p>
          </div>
        ) : (
          <>
            {/* Mobile: карточки */}
            <div className="md:hidden space-y-3">
              {sortedKpi.map((item) => {
                const initials = `${item.driver.first_name?.[0] || ''}${item.driver.last_name?.[0] || ''}`.toUpperCase();
                const consumptionClr = consumptionColor(item.avgConsumption);

                return (
                  <div
                    key={item.driver.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3"
                  >
                    {/* Заголовок: аватар + имя */}
                    <a
                      href={`/drivers/${item.driver.id}`}
                      className="flex items-center gap-3 active:opacity-70 transition-opacity"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {initials || '👤'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {item.driver.first_name} {item.driver.last_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          📞 {item.driver.phone || '—'}
                        </div>
                      </div>
                    </a>

                    {/* Рейсы — крупно */}
                    <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div className="text-xs text-blue-700 font-medium">Рейсов</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-blue-700">{item.monthTripsCount}</span>
                        <span className="text-xs text-blue-500">за месяц</span>
                        <span className="text-sm text-slate-400 ml-2">/ {item.totalTrips} всего</span>
                      </div>
                    </div>

                    {/* Экономика */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">ЗП месяц</div>
                        <div className="font-bold text-emerald-600 break-words">{item.salaryMonth.toFixed(0)} €</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">ЗП всего</div>
                        <div className="font-bold text-slate-600 break-words">{item.salaryTotal.toFixed(0)} €</div>
                      </div>
                    </div>

                    {/* Пробег и топливо */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Пробег</div>
                        <div className="font-semibold text-slate-700 break-words">
                          {item.totalKm > 0 ? `${item.totalKm.toFixed(0)} км` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Топливо</div>
                        <div className="font-semibold text-slate-700 break-words">
                          {item.totalLiters > 0 ? `${item.totalLiters.toFixed(0)} л` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Расход</div>
                        <div className={`font-semibold break-words ${consumptionClr}`}>
                          {item.avgConsumption !== null ? `${item.avgConsumption.toFixed(1)}` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Фрахт */}
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <div className="text-xs text-slate-400 font-medium">Общий фрахт</div>
                      <div className="font-bold text-green-600 break-words">
                        {item.totalRevenue.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Легенда mobile */}
              <div className="text-xs text-slate-500 bg-white rounded-xl border border-slate-100 p-4">
                <b>Расход</b> считается только по рейсам, где есть и пробег, и литры.
                <div className="mt-2 flex flex-wrap gap-3">
                  <span><span className="text-emerald-600 font-bold">●</span> норма (≤30)</span>
                  <span><span className="text-orange-500 font-bold">●</span> выше 30</span>
                  <span><span className="text-red-500 font-bold">●</span> выше 35</span>
                </div>
              </div>
            </div>

            {/* Desktop: таблица */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                    {sortedKpi.map((item) => {
                      const initials = `${item.driver.first_name?.[0] || ''}${item.driver.last_name?.[0] || ''}`.toUpperCase();
                      const consumptionClr = consumptionColor(item.avgConsumption);

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
                          <td className="px-4 py-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                            {item.salaryMonth.toFixed(0)} €
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600 whitespace-nowrap">
                            {item.salaryTotal.toFixed(0)} €
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 whitespace-nowrap">
                            {item.totalKm > 0 ? `${item.totalKm.toFixed(0)} км` : '—'}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 whitespace-nowrap">
                            {item.totalLiters > 0 ? `${item.totalLiters.toFixed(0)} л` : '—'}
                          </td>
                          <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap ${consumptionClr}`}>
                            {item.avgConsumption !== null ? `${item.avgConsumption.toFixed(1)} л/100км` : '—'}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-green-600 whitespace-nowrap">
                            {item.totalRevenue.toFixed(0)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
                <b>Расход</b> считается только по рейсам, где есть и пробег, и литры.
                {' · '}
                <span className="text-emerald-600">Зелёный</span> = норма, <span className="text-orange-500">оранжевый</span> = выше 30, <span className="text-red-500">красный</span> = выше 35.
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
