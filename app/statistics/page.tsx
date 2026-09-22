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
    const { data } = await supabase.from('trip_expenses').select('amount_eur, trip_id');
    allExpenses = data || [];
  }

  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('amount_eur, month_key, cost_type, expense_date');

  // ============================================================
  // ЭКСПЕДИРОВАНИЕ
  // ============================================================
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_price_eur, contractor_price_eur, load_date, unload_date, status');

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

  const fixedCostsByMonth: Record<string, number> = {};
  fixedCosts?.forEach((fc) => {
    const amount = fc.amount_eur || 0;
    if (amount === 0) return;
    if (fc.cost_type === 'yearly') {
      let startDate: Date | null = null;
      if (fc.expense_date) startDate = new Date(fc.expense_date);
      else if (fc.month_key) startDate = new Date(fc.month_key + '-01');
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

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;

    const monthTrips = tripsByMonth[monthKey] || [];
    const tripsCount = monthTrips.length;
    const tripRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const directExpenses = directExpensesByMonth[monthKey] || 0;

    const monthForwarding = forwardingByMonth[monthKey] || [];
    const forwardingCount = monthForwarding.length;
    const forwardingClientSum = monthForwarding.reduce((sum, f) => sum + (f.client_price_eur || 0), 0);
    const forwardingContractorSum = monthForwarding.reduce((sum, f) => sum + (f.contractor_price_eur || 0), 0);
    const forwardingMargin = forwardingClientSum - forwardingContractorSum;

    const fixedExpenses = fixedCostsByMonth[monthKey] || 0;

    const totalIncome = tripRevenue + forwardingClientSum;
    const totalExpenses = directExpenses + forwardingContractorSum + fixedExpenses;
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthKey,
      tripsCount, tripRevenue, directExpenses,
      forwardingCount, forwardingClientSum, forwardingContractorSum, forwardingMargin,
      fixedExpenses, totalIncome, totalExpenses, profit, margin,
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
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📊 Статистика</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Рейсы + Экспедирование за {year} год</p>
          </div>
          <div className="flex gap-2">
            {years.map((y) => (
              <a
                key={y}
                href={`/statistics?year=${y}`}
                className={`px-3 md:px-4 py-2 rounded-xl font-semibold text-sm transition-all
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

        {/* ИТОГИ ГОДА */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            🏆 Итоги {year} года
          </h2>
          <div className="grid gap-3 md:gap-5 grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Сделок</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-base md:text-xl">📊</div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-blue-600">
                {yearTotals.tripsCount + yearTotals.forwardingCount}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1">
                🚛 {yearTotals.tripsCount} · 📦 {yearTotals.forwardingCount}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Доход</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center text-base md:text-xl">💵</div>
              </div>
              <div className="text-xl md:text-3xl font-bold text-green-600 break-words">{yearTotals.totalIncome.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Фрахт: {yearTotals.tripRevenue.toFixed(0)} · Эксп.: {yearTotals.forwardingClientSum.toFixed(0)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Расходы</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center text-base md:text-xl">📉</div>
              </div>
              <div className="text-xl md:text-3xl font-bold text-red-500 break-words">{yearTotals.totalExpenses.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Рейсы: {(yearTotals.directExpenses + yearTotals.fixedExpenses).toFixed(0)} · Подряд.: {yearTotals.forwardingContractorSum.toFixed(0)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-base md:text-xl">📈</div>
              </div>
              <div className={`text-xl md:text-3xl font-bold break-words ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearTotals.profit.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1">
                Маржа: <b className={avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{avgMargin.toFixed(1)}%</b>
              </div>
            </div>
          </div>
        </div>

        {/* РАЗБИВКА */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">🚛 Рейсы (за год)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800">{yearTotals.tripsCount}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Фрахт</span>
                <span className="font-bold text-green-600 break-words text-right">{yearTotals.tripRevenue.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Прямые расходы</span>
                <span className="font-bold text-red-500 break-words text-right">−{yearTotals.directExpenses.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Прибыль</span>
                <span className={`font-bold break-words text-right ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tripProfit.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя за рейс: <b className="text-slate-600">{avgProfitPerTrip.toFixed(0)} €</b>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">📦 Экспедирование (за год)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800">{yearTotals.forwardingCount}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Доход</span>
                <span className="font-bold text-green-600 break-words text-right">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Подрядчикам</span>
                <span className="font-bold text-red-500 break-words text-right">−{yearTotals.forwardingContractorSum.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Маржа</span>
                <span className={`font-bold break-words text-right ${yearTotals.forwardingMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {yearTotals.forwardingMargin.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя за заявку: <b className="text-slate-600">
                  {yearTotals.forwardingCount > 0 ? (yearTotals.forwardingMargin / yearTotals.forwardingCount).toFixed(0) : 0} €
                </b>
              </div>
            </div>
          </div>
        </div>

        {/* ТАБЛИЦА ПО МЕСЯЦАМ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            📅 По месяцам
          </h2>

          {/* Mobile: карточки */}
          <div className="md:hidden space-y-3">
            {months.map((m) => {
              const isCurrentMonth = m.monthKey === currentMonthKey;
              const isFuture = m.monthKey > currentMonthKey;
              const isEmpty = m.tripsCount === 0 && m.forwardingCount === 0 && m.totalExpenses === 0;

              return (
                <div
                  key={m.monthKey}
                  className={`bg-white rounded-2xl border shadow-sm p-4
                    ${isCurrentMonth ? 'border-blue-300 bg-blue-50/40' :
                      isFuture ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}
                >
                  {/* Заголовок */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`font-bold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                      {m.monthName}
                    </span>
                    {isCurrentMonth && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                        ТЕКУЩИЙ
                      </span>
                    )}
                  </div>

                  {/* Доходы */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">🚛 Рейсов</span>
                      <span className="font-semibold text-slate-700">{m.tripsCount || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Фрахт</span>
                      <span className="font-semibold text-green-600 break-words text-right">
                        {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">📦 Эксп.</span>
                      <span className="font-semibold text-slate-700">{m.forwardingCount || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Маржа эксп.</span>
                      <span className="font-semibold text-emerald-600 break-words text-right">
                        {m.forwardingMargin > 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Расходы и итог */}
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Прямые / Общие</span>
                      <span className="font-medium text-slate-600 break-words text-right">
                        {m.directExpenses.toFixed(0)} / {m.fixedExpenses.toFixed(0)} €
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Всего расходов</span>
                      <span className="font-semibold text-red-500 break-words text-right">
                        {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                      <span className="font-semibold text-slate-800">Прибыль</span>
                      <span className={`font-bold text-base break-words text-right ${
                        isFuture ? 'text-slate-400' :
                        m.profit > 0 ? 'text-emerald-600' :
                        m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Маржа</span>
                      <span className={`font-semibold text-right ${
                        isFuture ? 'text-slate-400' :
                        m.margin > 0 ? 'text-emerald-600' :
                        m.margin < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {m.totalIncome > 0 ? `${m.margin.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Итого мобильный */}
            <div className="bg-slate-100 rounded-2xl border-2 border-slate-200 p-4">
              <div className="font-bold text-slate-900 mb-3">ИТОГО за {year}</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">🚛 Рейсов</span>
                  <span className="font-bold text-slate-900">{yearTotals.tripsCount}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Фрахт</span>
                  <span className="font-bold text-green-600 break-words text-right">{yearTotals.tripRevenue.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">📦 Эксп.</span>
                  <span className="font-bold text-slate-900">{yearTotals.forwardingCount}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Маржа эксп.</span>
                  <span className="font-bold text-emerald-600 break-words text-right">{yearTotals.forwardingMargin.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Всего расходов</span>
                  <span className="font-bold text-red-500 break-words text-right">{yearTotals.totalExpenses.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-300">
                  <span className="font-bold text-slate-800">Прибыль</span>
                  <span className={`font-bold text-lg break-words text-right ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {yearTotals.profit.toFixed(0)} €
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Маржа</span>
                  <span className={`font-bold text-right ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {avgMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: таблица */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
          <div><b>Рейс относится к месяцу окончания.</b> Экспедиция — к месяцу загрузки.</div>
          <div><b>Годовые расходы</b> делятся на 12 месяцев.</div>
          <div><b>Прибыль</b> = Фрахт + Доход экспедиций − Прямые − Подрядчики − Общие.</div>
          <div><b>Маржа</b> = Прибыль ÷ Общий доход × 100%.</div>
        </div>

      </div>
    </main>
  );
}
