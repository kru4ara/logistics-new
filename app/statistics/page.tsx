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

  // Рейсы за год
  const { data: trips } = await supabase
    .from('trips')
    .select('id, revenue_eur, start_date, status')
    .gte('start_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`);

  const tripIds = trips?.map((t) => t.id) || [];

  // Прямые расходы (по дате расхода)
  let allExpenses: any[] = [];
  if (tripIds.length > 0) {
    const { data } = await supabase
      .from('trip_expenses')
      .select('amount_eur, expense_date, trip_id')
      .in('trip_id', tripIds);
    allExpenses = data || [];
  }

  // Общие расходы (fixed_costs)
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('amount_eur, month_key, cost_type')
    .gte('month_key', `${year}-01`)
    .lte('month_key', `${year}-12`);

  // Считаем по месяцам
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;

    const monthTrips = trips?.filter((t) => t.start_date && t.start_date.startsWith(monthKey)) || [];
    const revenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const tripsCount = monthTrips.length;

    const monthExpenses = allExpenses.filter((e) => e.expense_date && e.expense_date.startsWith(monthKey));
    const directExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount_eur || 0), 0);

    const monthFixed = fixedCosts?.filter((f) => f.month_key === monthKey) || [];
    const fixedExpenses = monthFixed.reduce((sum, f) => sum + (f.amount_eur || 0), 0);

    const totalExpenses = directExpenses + fixedExpenses;
    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthShort: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short' }),
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

  // Итоги за год
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

  // Список годов для переключателя
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📊 Статистика</h1>
            <p className="text-slate-500 mt-1">Показатели компании за {year} год</p>
          </div>

          {/* Переключатель года */}
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

        {/* Итоги года */}
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

        {/* Таблица по месяцам */}
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

        {/* Пояснение */}
        <div className="text-xs text-slate-500 bg-white rounded-xl border border-slate-100 p-4">
          <b>Прямые расходы</b> — расходы, привязанные к рейсам (топливо, EPI, e-TOLL, граница, ЗП водителя, подрядчики).
          <br />
          <b>Общие расходы</b> — расходы, не привязанные к рейсам (страховки, бухгалтерия, администрация).
          <br />
          <b>Маржа</b> = Прибыль ÷ Фрахт × 100%. Хорошая маржа для логистики: 15–25%.
        </div>

      </div>
    </main>
  );
}
