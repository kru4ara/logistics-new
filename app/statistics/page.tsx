import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function StatisticsPage({ searchParams }: { searchParams: { year?: string } }) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const currentYear = new Date().getFullYear();
  const year = parseInt(searchParams?.year || String(currentYear));

  // ============================================================
  // РЕЙСЫ
  // ============================================================
  const { data: trips } = await supabase
    .from('trips')
    .select('id, revenue_eur, start_date, end_date, status');

  const tripIds = trips?.map((t) => t.id) || [];

  let allExpenses: any[] = [];
  if (tripIds.length > 0) {
    const { data } = await supabase
      .from('trip_expenses')
      .select('amount_eur, trip_id');
    allExpenses = data || [];
  }

  // Общие расходы
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('amount_eur, month_key, cost_type, expense_date');

  // ============================================================
  // ЭКСПЕДИРОВАНИЕ
  // ============================================================
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_price_eur, contractor_price_eur, load_date, unload_date, status');

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
      let startDate: Date | null = null;
      if (fc.expense_date) {
        startDate = new Date(fc.expense_date);
      } else if (fc.month_key) {
        startDate = new Date(fc.month_key + '-01');
      }
      if (!startDate) return;

      const monthlyPart = amount / 12;

      for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        fixedCostsByMonth[mk] = (fixedCostsByMonth[mk] || 0) + monthlyPart;
      }
    } else {
      if (fc.month_key) {
        fixedCostsByMonth[fc.month_key] = (fixedCostsByMonth[fc.month_key] || 0) + amount;
      }
    }
  });

  // === Экспедиции по месяцам (по дате загрузки) ===
  function getForwardingMonthKey(f: any): string | null {
    const date = f.load_date || f.unload_date;
    if (!date) return null;
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const forwardingByMonth: Record<string, any[]> = {};
  forwarding?.forEach((f) => {
    const mk = getForwardingMonthKey(f);
    if (!mk) return;
    if (!forwardingByMonth[mk]) forwardingByMonth[mk] = [];
    forwardingByMonth[mk].push(f);
  });

  // === Собираем данные по месяцам выбранного года ===
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;

    // Рейсы
    const monthTrips = tripsByMonth[monthKey] || [];
    const tripsCount = monthTrips.length;
    const tripRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const directExpenses = directExpensesByMonth[monthKey] || 0;

    // Экспедиции
    const monthForwarding = forwardingByMonth[monthKey] || [];
    const forwardingCount = monthForwarding.length;
    const forwardingClientSum = monthForwarding.reduce((sum, f) => sum + (f.client_price_eur || 0), 0);
    const forwardingContractorSum = monthForwarding.reduce((sum, f) => sum + (f.contractor_price_eur || 0), 0);
    const forwardingMargin = forwardingClientSum - forwardingContractorSum;

    // Общие расходы
    const fixedExpenses = fixedCostsByMonth[monthKey] || 0;

    // Комбинированные итоги
    const totalIncome = tripRevenue + forwardingClientSum;
    const totalExpenses = directExpenses + forwardingContractorSum + fixedExpenses;
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthKey,
      // Рейсы
      tripsCount,
      tripRevenue,
      directExpenses,
      // Экспедиции
      forwardingCount,
      forwardingClientSum,
      forwardingContractorSum,
      forwardingMargin,
      // Общие
      fixedExpenses,
      totalIncome,
      totalExpenses,
      profit,
      margin,
    });
  }

  const yearTotals = months.reduce(
    (acc, m) => ({
      tripsCount: acc.tripsCount + m.tripsCount,
      tripRevenue: acc.tripRevenue + m.tripRevenue,
      directExpenses: acc.directExpenses + m.directExpenses,
      forwardingCount: acc.forwardingCount + m.forwardingCount,
      forwardingClientSum: acc.forwardingClientSum + m.forwardingClientSum,
      forwardingContractorSum: acc.forwardingContractorSum + m.forwardingContractorSum,
      forwardingMargin: acc.forwardingMargin + m.forwardingMargin,
      fixedExpenses: acc.fixedExpenses + m.fixedExpenses,
      totalIncome: acc.totalIncome + m.totalIncome,
      totalExpenses: acc.totalExpenses + m.totalExpenses,
      profit: acc.profit + m.profit,
    }),
    {
      tripsCount: 0, tripRevenue: 0, directExpenses: 0,
      forwardingCount: 0, forwardingClientSum: 0, forwardingContractorSum: 0, forwardingMargin: 0,
      fixedExpenses: 0, totalIncome: 0, totalExpenses: 0, profit: 0,
    }
  );

  const avgMargin = yearTotals.totalIncome > 0 ? (yearTotals.profit / yearTotals.totalIncome) * 100 : 0;
  const tripProfit = yearTotals.tripRevenue - yearTotals.directExpenses;
  const avgProfitPerTrip = yearTotals.tripsCount > 0 ? tripProfit / yearTotals.tripsCount : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📊 Статистика</h1>
            <p className="text-slate-500 mt-1">Рейсы + Экспедирование за {year} год</p>
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

        {/* ============================================================ */}
        {/* ИТОГИ ГОДА — КОМБИНИРОВАННЫЕ                                    */}
        {/* ============================================================ */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            🏆 Итоги {year} года (Рейсы + Экспедирование)
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Сделок за год</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📊</div>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {yearTotals.tripsCount + yearTotals.forwardingCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                🚛 {yearTotals.tripsCount} рейсов · 📦 {yearTotals.forwardingCount} экспедиций
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Общий доход</span>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
              </div>
              <div className="text-3xl font-bold text-green-600">{yearTotals.totalIncome.toFixed(0)} €</div>
              <div className="text-xs text-slate-400 mt-1">
                Фрахт: {yearTotals.tripRevenue.toFixed(0)} € · Эксп.: {yearTotals.forwardingClientSum.toFixed(0)} €
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Общие расходы</span>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
              </div>
              <div className="text-3xl font-bold text-red-500">{yearTotals.totalExpenses.toFixed(0)} €</div>
              <div className="text-xs text-slate-400 mt-1">
                Рейсы: {(yearTotals.directExpenses + yearTotals.fixedExpenses).toFixed(0)} € · Подрядчики: {yearTotals.forwardingContractorSum.toFixed(0)} €
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Чистая прибыль</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">📈</div>
              </div>
              <div className={`text-3xl font-bold ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearTotals.profit.toFixed(0)} €
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Общая маржа: <b className={avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{avgMargin.toFixed(1)}%</b>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* РАЗБИВКА ПО НАПРАВЛЕНИЯМ                                       */}
        {/* ============================================================ */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Рейсы */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
              🚛 Рейсы (за год)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800">{yearTotals.tripsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Фрахт (доход)</span>
                <span className="font-bold text-green-600">{yearTotals.tripRevenue.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Прямые расходы</span>
                <span className="font-bold text-red-500">−{yearTotals.directExpenses.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Прибыль от рейсов</span>
                <span className={`font-bold ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tripProfit.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя прибыль за рейс: <b className="text-slate-600">{avgProfitPerTrip.toFixed(0)} €</b>
              </div>
            </div>
          </div>

          {/* Экспедиции */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
              📦 Экспедирование (за год)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800">{yearTotals.forwardingCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Доход от клиентов</span>
                <span className="font-bold text-green-600">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Оплата подрядчикам</span>
                <span className="font-bold text-red-500">−{yearTotals.forwardingContractorSum.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Маржа экспедирования</span>
                <span className={`font-bold ${yearTotals.forwardingMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {yearTotals.forwardingMargin.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя маржа за заявку: <b className="text-slate-600">
                  {yearTotals.forwardingCount > 0
                    ? (yearTotals.forwardingMargin / yearTotals.forwardingCount).toFixed(0)
                    : 0} €
                </b>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ТАБЛИЦА ПО МЕСЯЦАМ                                            */}
        {/* ============================================================ */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            📅 По месяцам
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Месяц</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">🚛 Рейсов</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">📦 Эксп.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа эксп.</th>
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
                    const isEmpty = m.tripsCount === 0 && m.forwardingCount === 0 && m.totalExpenses === 0;

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
                          {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-center font-semibold ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                          {m.forwardingCount > 0 ? m.forwardingCount : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold ${isFuture ? 'text-slate-400' : 'text-emerald-600'}`}>
                          {m.forwardingMargin > 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
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
                          {m.totalIncome > 0 ? `${m.margin.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200">
                    <td className="px-4 py-4 font-bold text-slate-900">ИТОГО за {year}</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">{yearTotals.tripsCount}</td>
                    <td className="px-4 py-4 text-right font-bold text-green-600">{yearTotals.tripRevenue.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">{yearTotals.forwardingCount}</td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-600">{yearTotals.forwardingMargin.toFixed(0)} €</td>
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
            <b>Экспедиция относится к месяцу загрузки.</b> Если даты загрузки нет — берётся дата выгрузки.
          </div>
          <div>
            <b>Годовые расходы</b> делятся на 12 месяцев и «размазываются» с месяца оплаты.
          </div>
          <div>
            <b>Прибыль</b> = Фрахт + Доход экспедиций − Прямые − Оплата подрядчикам − Общие.
          </div>
          <div>
            <b>Маржа</b> = Прибыль ÷ Общий доход × 100%. Хорошая маржа для логистики: 15–25%.
          </div>
        </div>

      </div>
    </main>
  );
}
