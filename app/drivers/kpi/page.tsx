import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import {
  ArrowLeft,
  BarChart3,
  User as UserIcon,
  Phone,
  TrendingUp,
  TrendingDown,
  Wallet,
  Gauge,
  Fuel,
  Package,
} from 'lucide-react';

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
    .select('id, driver_id, revenue_eur, actual_km, actual_liters, start_date, end_date, status');

  const { data: salaryExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur, expense_date')
    .eq('category', 'salary');

  const tripToDriver: Record<string, string> = {};
  (trips || []).forEach((t) => {
    if (t.driver_id) tripToDriver[t.id] = t.driver_id;
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const monthSalaryByDriver: Record<string, number> = {};
  (salaryExpenses || []).forEach((e) => {
    if (!e.trip_id || !e.expense_date) return;
    const driverId = tripToDriver[e.trip_id];
    if (!driverId) return;
    const d = new Date(e.expense_date);
    if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;
    monthSalaryByDriver[driverId] =
      (monthSalaryByDriver[driverId] || 0) + Number(e.amount_eur || 0);
  });

  const totalSalaryByDriver: Record<string, number> = {};
  (salaryExpenses || []).forEach((e) => {
    if (!e.trip_id) return;
    const driverId = tripToDriver[e.trip_id];
    if (!driverId) return;
    totalSalaryByDriver[driverId] =
      (totalSalaryByDriver[driverId] || 0) + Number(e.amount_eur || 0);
  });

  const kpi = drivers?.map((driver) => {
    const driverTrips = trips?.filter((t) => t.driver_id === driver.id) || [];

    const monthTrips = driverTrips.filter((t) => {
      const dateStr = t.end_date || t.start_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalTrips = driverTrips.length;
    const monthTripsCount = monthTrips.length;

    const salaryMonth = monthSalaryByDriver[driver.id] || 0;
    const salaryTotal = totalSalaryByDriver[driver.id] || 0;

    const totalKm = driverTrips.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLiters = driverTrips.reduce((sum, t) => sum + (t.actual_liters || 0), 0);

    const tripsWithFuel = driverTrips.filter(
      (t) => t.actual_km && t.actual_km > 0 && t.actual_liters
    );
    const totalKmForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_km || 0), 0);
    const totalLitersForFuel = tripsWithFuel.reduce((sum, t) => sum + (t.actual_liters || 0), 0);
    const avgConsumption = totalKmForFuel > 0 ? (totalLitersForFuel / totalKmForFuel) * 100 : null;

    const totalRevenue = driverTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);

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

        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все водители
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            KPI водителей
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            За <b className="text-slate-700 capitalize">{monthName}</b> и за всё время
          </p>
        </div>

        {sortedKpi.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
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
                  <a
                    key={item.driver.id}
                    href={`/drivers/${item.driver.id}`}
                    className="block card card-hover p-4 space-y-3 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-brand">
                        {initials || <UserIcon className="w-5 h-5" strokeWidth={2} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {item.driver.first_name} {item.driver.last_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                          <Phone className="w-3 h-3 shrink-0" strokeWidth={2} />
                          <span className="truncate">{item.driver.phone || '—'}</span>
                        </div>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-brand-500 rotate-180 shrink-0" strokeWidth={2.5} />
                    </div>

                    {/* Рейсы — крупно */}
                    <div className="bg-brand-50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-brand-700 font-medium">
                        <Package className="w-3.5 h-3.5" strokeWidth={2} />
                        Рейсов
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-brand-700 tabular-nums">{item.monthTripsCount}</span>
                        <span className="text-xs text-brand-500">за месяц</span>
                        <span className="text-sm text-slate-400 ml-2 tabular-nums">/ {item.totalTrips} всего</span>
                      </div>
                    </div>

                    {/* Экономика */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">ЗП месяц</div>
                        <div className="font-bold text-emerald-600 break-words tabular-nums">{item.salaryMonth.toFixed(0)} €</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">ЗП всего</div>
                        <div className="font-bold text-slate-600 break-words tabular-nums">{item.salaryTotal.toFixed(0)} €</div>
                      </div>
                    </div>

                    {/* Пробег и топливо */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Пробег</div>
                        <div className="font-semibold text-slate-700 break-words tabular-nums">
                          {item.totalKm > 0 ? `${item.totalKm.toFixed(0)} км` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Топливо</div>
                        <div className="font-semibold text-slate-700 break-words tabular-nums">
                          {item.totalLiters > 0 ? `${item.totalLiters.toFixed(0)} л` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-medium">Расход</div>
                        <div className={`font-semibold break-words tabular-nums ${consumptionClr}`}>
                          {item.avgConsumption !== null ? `${item.avgConsumption.toFixed(1)}` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Фрахт */}
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <div className="text-xs text-slate-400 font-medium">Общий фрахт</div>
                      <div className="font-bold text-green-600 break-words tabular-nums">
                        {item.totalRevenue.toFixed(0)} €
                      </div>
                    </div>
                  </a>
                );
              })}

              {/* Легенда */}
              <div className="text-xs text-slate-500 card p-4">
                <div className="flex items-start gap-2">
                  <Fuel className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <b className="text-slate-700">Расход</b> считается только по рейсам, где есть и пробег, и литры.
                    <div className="mt-2 flex flex-wrap gap-3">
                      <span className="flex items-center gap-1"><span className="text-emerald-600 font-bold">●</span> норма (≤30)</span>
                      <span className="flex items-center gap-1"><span className="text-orange-500 font-bold">●</span> выше 30</span>
                      <span className="flex items-center gap-1"><span className="text-red-500 font-bold">●</span> выше 35</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: таблица */}
            <div className="hidden md:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Водитель</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Рейсов<br/>
                        <span className="text-[10px] font-normal text-slate-400 normal-case">мес / всего</span>
                      </th>
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
                          className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors relative"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-brand">
                                {initials || <UserIcon className="w-4 h-4" strokeWidth={2} />}
                              </div>
                              <div className="min-w-0">
                                <a
                                  href={`/drivers/${item.driver.id}`}
                                  className="font-semibold text-slate-800 hover:text-brand-600 transition-colors block truncate
                                             after:absolute after:inset-0 after:content-['']"
                                >
                                  {item.driver.first_name} {item.driver.last_name}
                                </a>
                                <div className="text-xs text-slate-400 truncate">{item.driver.phone || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-lg font-bold text-brand-600 tabular-nums">{item.monthTripsCount}</span>
                              <span className="text-xs text-slate-400 tabular-nums">/ {item.totalTrips}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                            {item.salaryMonth.toFixed(0)} €
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600 whitespace-nowrap tabular-nums">
                            {item.salaryTotal.toFixed(0)} €
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 whitespace-nowrap tabular-nums">
                            {item.totalKm > 0 ? `${item.totalKm.toFixed(0)} км` : '—'}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 whitespace-nowrap tabular-nums">
                            {item.totalLiters > 0 ? `${item.totalLiters.toFixed(0)} л` : '—'}
                          </td>
                          <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap tabular-nums ${consumptionClr}`}>
                            {item.avgConsumption !== null ? `${item.avgConsumption.toFixed(1)} л/100км` : '—'}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-green-600 whitespace-nowrap tabular-nums">
                            {item.totalRevenue.toFixed(0)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex items-start gap-2">
                <Fuel className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <b>Расход</b> считается только по рейсам, где есть и пробег, и литры.
                  {' · '}
                  <span className="text-emerald-600">Зелёный</span> = норма, <span className="text-orange-500">оранжевый</span> = выше 30, <span className="text-red-500">красный</span> = выше 35.
                  {' · '}
                  <b>Рейсы за месяц</b> — по дате финиша. <b>ЗП за месяц</b> — по дате выплаты.
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
