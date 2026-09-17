import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function StatisticsPage({ searchParams }: { searchParams: { year?: string } }) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const currentYear = new Date().getFullYear();
  const year = parseInt(searchParams?.year || String(currentYear));

  // Загружаем ВСЕ рейсы (нужны и соседние годы — рейсы могут пересекать год)
  const { data: trips } = await supabase
    .from('trips')
    .select('id, revenue_eur, start_date, end_date, status');

  const tripIds = trips?.map((t) => t.id) || [];

  // Все прямые расходы
  let allExpenses: any[] = [];
  if (tripIds.length > 0) {
    const { data } = await supabase
      .from('trip_expenses')
      .select('amount_eur, trip_id');
    allExpenses = data || [];
  }

  // Все общие расходы (нужны все годы — годовые могут «переезжать» через границу года)
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('amount_eur, month_key, cost_type, expense_date');

  // === Логика 1: рейс относится к месяцу окончания ===
  function getTripMonthKey(trip: any): string | null {
    const date = trip.end_date || trip.start_date;
    if (!date) return null;
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const tripsByMonth: Record<string, any[]> = {};
  trips?.forEach((t) => {
    const mk = getTripMonthKey(t);
    if (!mk) return;
    if (!tripsByMonth[mk]) tripsByMonth[mk] = [];
    tripsByMonth[mk].push(t);
  });

  // Считаем прямые расходы по месяцу рейса (а не по дате расхода)
  // Это делает каждый рейс цельным блоком
  const directExpensesByMonth: Record<string, number> = {};
  Object.entries(tripsByMonth).forEach(([mk, monthTrips]) => {
    const ids = monthTrips.map((t) => t.id);
    const sum = allExpenses
      .filter((e) => ids.includes(e.trip_id))
      .reduce((s, e) => s + (e.amount_eur || 0), 0);
    directExpensesByMonth[mk] = sum;
  });

  // === Логика 2: годовые расходы растягиваются с месяца оплаты на 12 месяцев ===
  const fixedCostsByMonth: Record<string, number> = {};

  fixedCosts?.forEach((fc) => {
    const amount = fc.amount_eur || 0;
    if (amount === 0) return;

    if (fc.cost_type === 'yearly') {
      // Определяем стартовый месяц
      let startDate: Date | null = null;
      if (fc.expense_date) {
        startDate = new Date(fc.expense_date);
      } else if (fc.month_key) {
        startDate = new Date(fc.month_key + '-01');
      }
      if (!startDate) return;

      const monthlyPart = amount / 12;

      // Раскидываем на 12 месяцев вперёд
      for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        fixedCostsByMonth[mk] = (fixedCostsByMonth[mk] || 0) + monthlyPart;
      }
    } else {
      // Месячный / рата / одноразовый — в свой месяц
      if (fc.month_key) {
        fixedCostsByMonth[fc.month_key] = (fixedCostsByMonth[fc.month_key] || 0) + amount;
      }
    }
  });

  // Собираем данные по месяцам выбранного года
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;

    const monthTrips = tripsByMonth[monthKey] || [];
    const tripsCount = monthTrips.length;
    const revenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);

    const directExpenses = directExpensesByMonth[monthKey] || 0;
    const fixedExpenses = fixedCostsByMonth[monthKey] || 0;
    const totalExpenses = directExpenses + fixedExpenses;
    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthKey,
      tripsCount,
      revenue,
      directExpenses,
      fixedExpenses,
      totalExpenses,
      profit,
      margin,
    });
  }

  const yearTotals = months.reduce(
    (acc, m) => ({
      tripsCount: acc.tripsCount + m.tripsCount,
      revenue: acc.revenue + m.revenue,
      directExpenses: acc.directExpenses + m.directExpenses,
      fixedExpenses: acc.fixedExpenses + m.fixedExpenses,
      totalExpenses: acc.totalExpenses + m.totalExpenses,
      profit: acc.profit + m.profit,
    }),
    { tripsCount: 0, revenue: 0, directExpenses: 0, fixedExpenses: 0, totalExpenses: 0, profit: 0 }
  );

  const avgMargin = yearTotals.revenue > 0 ? (yearTotals.profit / yearTotals.revenue) * 100 : 0;
  const avgProfitPerTrip = yearTotals.tripsCount > 0 ? yearTotals.profit / yearTotals.tripsCount : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📊 Статистика</h1>
            <p className="text-slate-500 mt-1">Показатели компании за {year} год</p>
          </div>

          <div className="flex gap-2">
            {years.map((y) => (
              <a
                key={y}
                href={`/statistics?year=${y}`}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all
                  ${y === year
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                  }`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            🏆 Итоги {year} года
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Рейсов за год</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📋</div>
              </div>
              <div className="text-3xl font-bold text-blue-600">{yearTotals.tripsCount}</div>
              <div className="text-xs text-slate-400 mt-1">
                Средняя прибыль за рейс: <b className="text-slate-600">{avgProfitPerTrip.toFixed(0)} €</b>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Фрахт за год</span>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
              </div>
              <div className="text-3xl font-bold text-green-600">{yearTotals.revenue.toFixed(0)} €</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Расходы за год</span>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
              </div>
              <div className="text-3xl font-bold text-red-500">{yearTotals.totalExpenses.toFixed(0)} €</div>
              <div className="text-xs text-slate-400 mt-1">
                Прямые: {yearTotals.directExpenses.toFixed(0)} € · Общие: {yearTotals.fixedExpenses.toFixed(0)} €
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Прибыль за год</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">📈</div>
              </div>
              <div className={`text-3xl font-bold ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearTotals.profit.toFixed(0)} €
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Средняя маржа: <b className={avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{avgMargin.toFixed(1)}%</b>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            📅 По месяцам
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Месяц</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прямые</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Общие</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Всего расходов</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => {
                    const isCurrentMonth = m.monthKey === currentMonthKey;
                    const isFuture = m.monthKey > currentMonthKey;
                    const isEmpty = m.tripsCount === 0 && m.totalExpenses === 0;

                    return (
                      <tr
                        key={m.monthKey}
                        className={`border-b border-slate-50 transition-colors
                          ${isCurrentMonth ? 'bg-blue-50/50' :
                            isFuture ? 'bg-slate-50/30 text-slate-400' :
                            'hover:bg-blue-50/30'}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-800'}`}>
                              {m.monthName}
                            </span>
                            {isCurrentMonth && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                                ТЕКУЩИЙ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-4 text-center font-semibold ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                          {m.tripsCount > 0 ? m.tripsCount : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold ${isFuture ? 'text-slate-400' : 'text-green-600'}`}>
                          {m.revenue > 0 ? `${m.revenue.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.directExpenses > 0 ? `${m.directExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.fixedExpenses > 0 ? `${m.fixedExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-medium ${isFuture ? 'text-slate-400' : 'text-red-500'}`}>
                          {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-bold ${
                          isFuture ? 'text-slate-400' :
                          m.profit > 0 ? 'text-emerald-600' :
                          m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold ${
                          isFuture ? 'text-slate-400' :
                          m.margin > 0 ? 'text-emerald-600' :
                          m.margin < 0 ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {m.revenue > 0 ? `${m.margin.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200">
                    <td className="px-4 py-4 font-bold text-slate-900">ИТОГО за {year}</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">{yearTotals.tripsCount}</td>
                    <td className="px-4 py-4 text-right font-bold text-green-600">{yearTotals.revenue.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700">{yearTotals.directExpenses.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700">{yearTotals.fixedExpenses.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-red-500">{yearTotals.totalExpenses.toFixed(0)} €</td>
                    <td className={`px-4 py-4 text-right font-bold text-lg ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {yearTotals.profit.toFixed(0)} €
                    </td>
                    <td className={`px-4 py-4 text-right font-bold ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {avgMargin.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <div>
            <b>Рейс относится к месяцу окончания.</b> Если рейс стартовал в октябре, а завершился в ноябре — он считается ноябрьским (и его расходы тоже).
          </div>
          <div>
            <b>Годовые расходы</b> делятся на 12 месяцев и «размазываются» с месяца оплаты (например, страховка за 1595 €, оплаченная в декабре, даёт по 133 € на декабрь, январь, февраль и т.д.).
          </div>
          <div>
            <b>Месячные, раты, одноразовые</b> расходы учитываются в своём месяце как есть.
          </div>
          <div>
            <b>Маржа</b> = Прибыль ÷ Фрахт × 100%. Хорошая маржа для логистики: 15–25%.
          </div>
        </div>

      </div>
    </main>
  );
}
