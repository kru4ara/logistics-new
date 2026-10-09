import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Trophy,
  Calendar,
  Inbox,
  Fuel,
  Gauge,
  Route as RouteIcon,
  Wallet,
} from 'lucide-react';
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

  const { data: trips } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, end_date, actual_km, actual_liters, status')
    .eq('driver_id', driverId);

  const tripIds = (trips || []).map((t) => t.id);

  type SalaryRow = { amount_eur: number; expense_date: string | null };
  let salaryRows: SalaryRow[] = [];

  if (tripIds.length > 0) {
    const { data: salaryExp } = await supabase
      .from('trip_expenses')
      .select('amount_eur, expense_date')
      .eq('category', 'salary')
      .in('trip_id', tripIds);
    salaryRows = (salaryExp || []) as SalaryRow[];
  }

  const salaryByMonth: Record<string, number> = {};
  for (const e of salaryRows) {
    if (!e.expense_date) continue;
    const d = new Date(e.expense_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    salaryByMonth[key] = (salaryByMonth[key] || 0) + Number(e.amount_eur || 0);
  }

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

  const allMonths: MonthRow[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;

    const monthName = d.toLocaleDateString('ru-RU', { month: 'long' });
    const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const label = `${monthNameCap} ${y}`;

    let tripsCount = 0;
    let km = 0;
    let liters = 0;

    (trips || []).forEach((t) => {
      const dateStr = t.end_date || t.start_date;
      if (!dateStr) return;
      const td = new Date(dateStr);
      if (td.getFullYear() !== y || td.getMonth() !== m) return;

      tripsCount += 1;
      km += Number(t.actual_km || 0);
      liters += Number(t.actual_liters || 0);
    });

    const consumption = km > 0 ? (liters / km) * 100 : 0;
    const salary = salaryByMonth[key] || 0;

    allMonths.push({
      key,
      label,
      trips: tripsCount,
      km: Math.round(km),
      liters: Math.round(liters),
      consumption: Math.round(consumption * 10) / 10,
      salary: Math.round(salary),
    });
  }

  const monthRows = allMonths.filter((r) => r.trips > 0 || r.salary > 0);

  const totalTrips = trips?.length || 0;
  const totalKm = (trips || []).reduce((s, t) => s + Number(t.actual_km || 0), 0);
  const totalLiters = (trips || []).reduce((s, t) => s + Number(t.actual_liters || 0), 0);
  const totalSalary = salaryRows.reduce((s, e) => s + Number(e.amount_eur || 0), 0);
  const totalConsumption = totalKm > 0 ? (totalLiters / totalKm) * 100 : 0;

  const activeTrips = monthRows.reduce((s, r) => s + r.trips, 0);
  const activeKm = monthRows.reduce((s, r) => s + r.km, 0);
  const activeLiters = monthRows.reduce((s, r) => s + r.liters, 0);
  const activeSalary = monthRows.reduce((s, r) => s + r.salary, 0);
  const activeConsumption = activeKm > 0 ? (activeLiters / activeKm) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Мои рейсы
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <BarChart3 className="w-6 h-6 text-brand-600" strokeWidth={2.2} />
            Моя статистика
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Ваши результаты за последние 12 месяцев
          </p>
        </div>

        {/* Итого за всё время */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
            За всё время
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 font-medium">Рейсов</div>
                <RouteIcon className="w-4 h-4 text-brand-500" strokeWidth={2.2} />
              </div>
              <div className="text-2xl font-bold text-brand-600 tabular-nums">{totalTrips}</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 font-medium">Пройдено</div>
                <Gauge className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">
                {Math.round(totalKm).toLocaleString('ru-RU')} <span className="text-base">км</span>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 font-medium">Ср. расход</div>
                <Fuel className="w-4 h-4 text-orange-500" strokeWidth={2.2} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">
                {totalConsumption.toFixed(1)} <span className="text-base">л/100</span>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 font-medium">Заработано</div>
                <Wallet className="w-4 h-4 text-emerald-500" strokeWidth={2.2} />
              </div>
              <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                {Math.round(totalSalary).toLocaleString('ru-RU')} <span className="text-base">€</span>
              </div>
            </div>
          </div>
        </div>

        {/* Таблица по месяцам */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
            По месяцам
          </h2>

          {monthRows.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                За последние 12 месяцев рейсов нет
              </h2>
              <p className="text-slate-500 text-sm">Ожидайте заданий от офиса</p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {monthRows.map((r) => {
                  const tripsWord =
                    r.trips === 1 ? 'рейс' : r.trips < 5 && r.trips > 1 ? 'рейса' : 'рейсов';

                  return (
                    <div key={r.key} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-bold text-slate-900">{r.label}</div>
                        {r.trips > 0 && (
                          <div className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                            {r.trips} {tripsWord}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-slate-400">Пройдено</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {r.km > 0 ? `${r.km.toLocaleString('ru-RU')} км` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Расход</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {r.consumption > 0 ? `${r.consumption.toFixed(1)} л/100` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Топливо</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {r.liters > 0 ? `${r.liters.toLocaleString('ru-RU')} л` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Зарплата</div>
                          <div className="font-semibold text-emerald-600 tabular-nums">
                            {r.salary > 0 ? `${r.salary.toLocaleString('ru-RU')} €` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Итого */}
                <div className="bg-slate-100 rounded-2xl border-2 border-slate-200 p-4">
                  <div className="font-bold text-slate-900 mb-3">Итого</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Рейсов</div>
                      <div className="font-bold text-slate-900 tabular-nums">{activeTrips}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Пройдено</div>
                      <div className="font-bold text-slate-900 tabular-nums">
                        {activeKm.toLocaleString('ru-RU')} км
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Ср. расход</div>
                      <div className="font-bold text-slate-900 tabular-nums">
                        {activeConsumption.toFixed(1)} л/100
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Заработано</div>
                      <div className="font-bold text-emerald-600 tabular-nums">
                        {activeSalary.toLocaleString('ru-RU')} €
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Месяц</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пройдено</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Топливо</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расход</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Зарплата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.map((r) => (
                        <tr
                          key={r.key}
                          className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors"
                        >
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {r.label}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums">
                            {r.trips > 0 ? r.trips : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums">
                            {r.km > 0 ? `${r.km.toLocaleString('ru-RU')} км` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums">
                            {r.liters > 0 ? `${r.liters.toLocaleString('ru-RU')} л` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums">
                            {r.consumption > 0 ? `${r.consumption.toFixed(1)} л/100` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-600 tabular-nums">
                            {r.salary > 0 ? `${r.salary.toLocaleString('ru-RU')} €` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-5 py-4 font-bold text-slate-900">Итого</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900 tabular-nums">{activeTrips}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900 tabular-nums">
                          {activeKm.toLocaleString('ru-RU')} км
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900 tabular-nums">
                          {activeLiters.toLocaleString('ru-RU')} л
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900 tabular-nums">
                          {activeConsumption.toFixed(1)} л/100
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-600 text-base tabular-nums">
                          {activeSalary.toLocaleString('ru-RU')} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
