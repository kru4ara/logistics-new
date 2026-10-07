import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function DriverStatsPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Все рейсы водителя
  const { data: trips } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, end_date, actual_km, actual_liters, status')
    .eq('driver_id', driverId);

  const tripIds = (trips || []).map((t) => t.id);

  // Зарплата по рейсам
  const salaryByTrip: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: salaryExp } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .eq('category', 'salary')
      .in('trip_id', tripIds);

    (salaryExp || []).forEach((e: any) => {
      if (!e.trip_id) return;
      salaryByTrip[e.trip_id] = (salaryByTrip[e.trip_id] || 0) + Number(e.amount_eur || 0);
    });
  }

  // ============================================================
  // Разбивка по месяцам — последние 12 месяцев (включая текущий)
  // ============================================================
  const now = new Date();

  type MonthRow = {
    key: string;
    label: string;
    trips: number;
    km: number;
    liters: number;
    consumption: number;
    salary: number;
  };

  const monthRows: MonthRow[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });

    let tripsCount = 0;
    let km = 0;
    let liters = 0;
    let salary = 0;

    (trips || []).forEach((t) => {
      const dateStr = t.end_date || t.start_date;
      if (!dateStr) return;
      const td = new Date(dateStr);
      if (td.getFullYear() !== y || td.getMonth() !== m) return;

      tripsCount += 1;
      km += Number(t.actual_km || 0);
      liters += Number(t.actual_liters || 0);
      salary += salaryByTrip[t.id] || 0;
    });

    const consumption = km > 0 ? (liters / km) * 100 : 0;

    monthRows.push({
      key,
      label,
      trips: tripsCount,
      km: Math.round(km),
      liters: Math.round(liters),
      consumption: Math.round(consumption * 10) / 10,
      salary: Math.round(salary),
    });
  }

  // ============================================================
  // Итого за всё время
  // ============================================================
  const totalTrips = trips?.length || 0;
  const totalKm = (trips || []).reduce((s, t) => s + Number(t.actual_km || 0), 0);
  const totalLiters = (trips || []).reduce((s, t) => s + Number(t.actual_liters || 0), 0);
  const totalSalary = Object.values(salaryByTrip).reduce((s, v) => s + v, 0);
  const totalConsumption = totalKm > 0 ? (totalLiters / totalKm) * 100 : 0;

  // ============================================================
  // Итого за 12 месяцев (footer таблицы)
  // ============================================================
  const year12Trips = monthRows.reduce((s, r) => s + r.trips, 0);
  const year12Km = monthRows.reduce((s, r) => s + r.km, 0);
  const year12Liters = monthRows.reduce((s, r) => s + r.liters, 0);
  const year12Salary = monthRows.reduce((s, r) => s + r.salary, 0);
  const year12Consumption = year12Km > 0 ? (year12Liters / year12Km) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          ← Мои рейсы
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">📊 Моя статистика</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Ваши результаты за последние 12 месяцев
          </p>
        </div>

        {/* Итого за всё время */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            🏆 За всё время
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Рейсов</div>
              <div className="text-2xl font-bold text-blue-600">{totalTrips}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Пройдено</div>
              <div className="text-2xl font-bold text-slate-800">
                {Math.round(totalKm).toLocaleString('ru-RU')} км
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Ср. расход</div>
              <div className="text-2xl font-bold text-slate-800">
                {totalConsumption.toFixed(1)} л/100
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Заработано</div>
              <div className="text-2xl font-bold text-emerald-600">
                {Math.round(totalSalary).toLocaleString('ru-RU')} €
              </div>
            </div>
          </div>
        </div>

        {/* Таблица по месяцам */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            📅 По месяцам
          </h2>

          {/* Mobile: карточки */}
          <div className="md:hidden space-y-2">
            {monthRows.map((r) => {
              const isEmpty = r.trips === 0;
              const tripsWord =
                r.trips === 1 ? 'рейс' : r.trips < 5 && r.trips > 1 ? 'рейса' : 'рейсов';

              return (
                <div
                  key={r.key}
                  className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 ${
                    isEmpty ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-slate-900 capitalize">{r.label}</div>
                    {r.trips > 0 && (
                      <div className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {r.trips} {tripsWord}
                      </div>
                    )}
                  </div>
                  {!isEmpty && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400">Пройдено</div>
                        <div className="font-semibold text-slate-800">
                          {r.km.toLocaleString('ru-RU')} км
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Расход</div>
                        <div className="font-semibold text-slate-800">
                          {r.consumption.toFixed(1)} л/100
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Топливо</div>
                        <div className="font-semibold text-slate-800">
                          {r.liters.toLocaleString('ru-RU')} л
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Зарплата</div>
                        <div className="font-semibold text-emerald-600">
                          {r.salary.toLocaleString('ru-RU')} €
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Итого за 12 месяцев */}
            <div className="bg-slate-100 rounded-2xl border-2 border-slate-200 p-4">
              <div className="font-bold text-slate-900 mb-3">Итого за 12 месяцев</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Рейсов</div>
                  <div className="font-bold text-slate-900">{year12Trips}</div>
                </div>
                <div>
                  <div className="text-slate-500">Пройдено</div>
                  <div className="font-bold text-slate-900">
                    {year12Km.toLocaleString('ru-RU')} км
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Ср. расход</div>
                  <div className="font-bold text-slate-900">
                    {year12Consumption.toFixed(1)} л/100
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Заработано</div>
                  <div className="font-bold text-emerald-600">
                    {year12Salary.toLocaleString('ru-RU')} €
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: таблица */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Месяц
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Рейсов
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Пройдено
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Топливо
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Расход
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Зарплата
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((r) => {
                    const isEmpty = r.trips === 0;
                    return (
                      <tr
                        key={r.key}
                        className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${
                          isEmpty ? 'opacity-40' : ''
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 capitalize">
                          {r.label}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {isEmpty ? '—' : r.trips}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {isEmpty ? '—' : `${r.km.toLocaleString('ru-RU')} км`}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {isEmpty ? '—' : `${r.liters.toLocaleString('ru-RU')} л`}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {isEmpty ? '—' : `${r.consumption.toFixed(1)} л/100`}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-600">
                          {isEmpty ? '—' : `${r.salary.toLocaleString('ru-RU')} €`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-4 font-bold text-slate-900">Итого за 12 месяцев</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">{year12Trips}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {year12Km.toLocaleString('ru-RU')} км
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {year12Liters.toLocaleString('ru-RU')} л
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {year12Consumption.toFixed(1)} л/100
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-600 text-base">
                      {year12Salary.toLocaleString('ru-RU')} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
