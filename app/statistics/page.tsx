import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import {
  BarChart3,
  Trophy,
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  Truck,
  Package,
  Calendar,
  Sigma,
  Info,
  Ban,
} from 'lucide-react';

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
    .select('id, amount_eur, month_key, cost_type, expense_date, category, currency, is_capex');

  // ============================================================
  // ЭКСПЕДИРОВАНИЕ
  // ============================================================
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_price_eur, load_date, unload_date, status');

  const forwardingIds = forwarding?.map((f) => f.id) || [];

  let contractorsByForwarding: Record<string, number> = {};
  if (forwardingIds.length > 0) {
    const { data: allContractors } = await supabase
      .from('forwarding_contractors')
      .select('forwarding_id, price_eur')
      .in('forwarding_id', forwardingIds);

    allContractors?.forEach((c) => {
      if (!c.forwarding_id) return;
      contractorsByForwarding[c.forwarding_id] =
        (contractorsByForwarding[c.forwarding_id] || 0) + (c.price_eur || 0);
    });
  }

  let expensesByForwarding: Record<string, number> = {};
  if (forwardingIds.length > 0) {
    const { data: allFExp } = await supabase
      .from('forwarding_expenses')
      .select('forwarding_id, amount_eur')
      .in('forwarding_id', forwardingIds);

    allFExp?.forEach((e) => {
      if (!e.forwarding_id) return;
      expensesByForwarding[e.forwarding_id] =
        (expensesByForwarding[e.forwarding_id] || 0) + (e.amount_eur || 0);
    });
  }

  // ============================================================
  // Рейсы → месяц окончания (или старта, если финиш не проставлен)
  // ============================================================
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

  // ============================================================
  // ФИКС-КОСТЫ: операционные → по месяцам, инвестиции → отдельный список
  // ============================================================
  const fixedCostsByMonth: Record<string, number> = {};

  type CapexItem = {
    id: string;
    category: string;
    amount_eur: number;
    currency: string;
    date: string;
    month_key: string | null;
  };
  const capexAll: CapexItem[] = [];

  fixedCosts?.forEach((fc) => {
    const amount = fc.amount_eur || 0;
    if (amount === 0) return;

    const isCapex = fc.is_capex === true;

    if (isCapex) {
      const dateStr = fc.expense_date || (fc.month_key ? fc.month_key + '-01' : null);
      if (!dateStr) return;
      capexAll.push({
        id: fc.id,
        category: fc.category || '—',
        amount_eur: amount,
        currency: fc.currency || 'EUR',
        date: dateStr,
        month_key: fc.month_key,
      });
      return;
    }

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

  const capexForYear = capexAll
    .filter((c) => {
      const d = new Date(c.date);
      return d.getFullYear() === year;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const capexTotalForYear = capexForYear.reduce((s, c) => s + c.amount_eur, 0);

  // ============================================================
  // Экспедиция → месяц загрузки
  // ============================================================
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

  // ============================================================
  // 12 месяцев
  // ============================================================
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
    const forwardingContractorSum = monthForwarding.reduce(
      (sum, f) => sum + (contractorsByForwarding[f.id] || 0),
      0
    );
    const forwardingExtraExpenses = monthForwarding.reduce(
      (sum, f) => sum + (expensesByForwarding[f.id] || 0),
      0
    );
    const forwardingMargin = forwardingClientSum - forwardingContractorSum - forwardingExtraExpenses;

    const fixedExpenses = fixedCostsByMonth[monthKey] || 0;

    const totalIncome = tripRevenue + forwardingClientSum;
    const totalExpenses =
      directExpenses + forwardingContractorSum + forwardingExtraExpenses + fixedExpenses;
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthKey,
      tripsCount, tripRevenue, directExpenses,
      forwardingCount, forwardingClientSum, forwardingContractorSum, forwardingExtraExpenses, forwardingMargin,
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
      forwardingExtraExpenses: acc.forwardingExtraExpenses + m.forwardingExtraExpenses,
      forwardingMargin: acc.forwardingMargin + m.forwardingMargin,
      fixedExpenses: acc.fixedExpenses + m.fixedExpenses,
      totalIncome: acc.totalIncome + m.totalIncome,
      totalExpenses: acc.totalExpenses + m.totalExpenses,
      profit: acc.profit + m.profit,
    }),
    {
      tripsCount: 0, tripRevenue: 0, directExpenses: 0,
      forwardingCount: 0, forwardingClientSum: 0, forwardingContractorSum: 0, forwardingExtraExpenses: 0, forwardingMargin: 0,
      fixedExpenses: 0, totalIncome: 0, totalExpenses: 0, profit: 0,
    }
  );

  const avgMargin = yearTotals.totalIncome > 0 ? (yearTotals.profit / yearTotals.totalIncome) * 100 : 0;
  const tripProfit = yearTotals.tripRevenue - yearTotals.directExpenses;
  const avgProfitPerTrip = yearTotals.tripsCount > 0 ? tripProfit / yearTotals.tripsCount : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ============================================================
  // ГОДЫ — из данных, а не хардкод
  // ============================================================
  const yearsSet = new Set<number>();
  yearsSet.add(currentYear);
  trips?.forEach((t) => {
    const d = t.end_date || t.start_date;
    if (d) yearsSet.add(new Date(d).getFullYear());
  });
  forwarding?.forEach((f) => {
    const d = f.load_date || f.unload_date;
    if (d) yearsSet.add(new Date(d).getFullYear());
  });
  fixedCosts?.forEach((fc) => {
    if (fc.month_key) {
      const y = parseInt(fc.month_key.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    }
    if (fc.expense_date) {
      yearsSet.add(new Date(fc.expense_date).getFullYear());
    }
  });
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* ЗАГОЛОВОК */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Статистика
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Рейсы + Экспедирование за {year} год
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <a
                key={y}
                href={`/statistics?year=${y}`}
                className={`px-3 md:px-4 py-2 rounded-xl font-semibold text-sm transition-all tabular-nums
                  ${y === year
                    ? 'bg-brand-600 text-white shadow-brand'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-brand-50 hover:border-brand-300'
                  }`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>

        {/* ИТОГИ ГОДА — 5 карточек */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
            Итоги {year} года
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Сделок</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2.2} />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
                {yearTotals.tripsCount + yearTotals.forwardingCount}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 inline-flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-0.5">
                  <Truck className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{yearTotals.tripsCount}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Package className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{yearTotals.forwardingCount}</span>
                </span>
              </div>
            </div>

            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Доход</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" strokeWidth={2.2} />
                </div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
                {yearTotals.totalIncome.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Фрахт: {yearTotals.tripRevenue.toFixed(0)} · Эксп.: {yearTotals.forwardingClientSum.toFixed(0)}
              </div>
            </div>

            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Опер. расходы</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-500" strokeWidth={2.2} />
                </div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
                {yearTotals.totalExpenses.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Рейсы: {(yearTotals.directExpenses + yearTotals.fixedExpenses).toFixed(0)} · Эксп.: {(yearTotals.forwardingContractorSum + yearTotals.forwardingExtraExpenses).toFixed(0)}
              </div>
            </div>

            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль P&L</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" strokeWidth={2.2} />
                </div>
              </div>
              <div className={`text-xl md:text-2xl font-bold break-words tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearTotals.profit.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1">
                Маржа: <b className={avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{avgMargin.toFixed(1)}%</b>
              </div>
            </div>

            <div className="card border-amber-200 p-4 md:p-5 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm font-medium text-amber-700">Инвестиции</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-amber-600" strokeWidth={2.2} />
                </div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-amber-600 break-words tabular-nums">
                {capexTotalForYear > 0 ? `${capexTotalForYear.toFixed(0)} €` : '—'}
              </div>
              <div className="text-[10px] md:text-xs text-amber-600/70 mt-1">
                вне P&L · {capexForYear.length} {capexForYear.length === 1 ? 'операция' : 'операций'}
              </div>
            </div>
          </div>
        </div>

        {/* РАЗБИВКА ПО НАПРАВЛЕНИЯМ */}
        <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
          <div className="card p-5 md:p-6">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
              Рейсы (за год)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800 tabular-nums">{yearTotals.tripsCount}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Фрахт (доход)</span>
                <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Прямые расходы</span>
                <span className="font-bold text-red-500 break-words text-right tabular-nums">−{yearTotals.directExpenses.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Прибыль рейсов</span>
                <span className={`font-bold break-words text-right tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tripProfit.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя за рейс: <b className="text-slate-600 tabular-nums">{avgProfitPerTrip.toFixed(0)} €</b>
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
              Экспедирование (за год)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Количество</span>
                <span className="font-bold text-slate-800 tabular-nums">{yearTotals.forwardingCount}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Доход от клиентов</span>
                <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Подрядчикам</span>
                <span className="font-bold text-red-500 break-words text-right tabular-nums">−{yearTotals.forwardingContractorSum.toFixed(0)} €</span>
              </div>
              {yearTotals.forwardingExtraExpenses > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Доп. расходы</span>
                  <span className="font-bold text-orange-600 break-words text-right tabular-nums">−{yearTotals.forwardingExtraExpenses.toFixed(0)} €</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
                <span className="text-slate-700 font-semibold">Маржа экспедиций</span>
                <span className={`font-bold break-words text-right tabular-nums ${yearTotals.forwardingMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {yearTotals.forwardingMargin.toFixed(0)} €
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Средняя за заявку: <b className="text-slate-600 tabular-nums">
                  {yearTotals.forwardingCount > 0 ? (yearTotals.forwardingMargin / yearTotals.forwardingCount).toFixed(0) : 0} €
                </b>
              </div>
            </div>
          </div>
        </div>

        {/* ИНВЕСТИЦИИ ЗА ГОД */}
        {capexForYear.length > 0 && (
          <div className="card border-amber-200 p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
                Инвестиции за {year}
              </h2>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                вне P&L
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Покупки активов: машины, прицепы, крупное оборудование.
              Эти суммы <b>не вычитаются</b> из операционной прибыли.
            </p>
            <div className="space-y-2">
              {capexForYear.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 border border-slate-100 rounded-xl p-3 md:p-4 bg-amber-50/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-sm break-words">
                      {c.category}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" strokeWidth={2} />
                      {new Date(c.date).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-bold text-amber-600 whitespace-nowrap tabular-nums">
                      {c.amount_eur.toFixed(0)} €
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-amber-200 flex justify-between items-baseline gap-2 flex-wrap">
              <span className="text-sm text-slate-500">
                Всего операций: <b className="text-slate-700 tabular-nums">{capexForYear.length}</b>
              </span>
              <span className="text-sm text-slate-500">
                Итого инвестиций: <b className="text-amber-600 text-base tabular-nums">{capexTotalForYear.toFixed(0)} €</b>
              </span>
            </div>
          </div>
        )}

        {/* ТАБЛИЦА ПО МЕСЯЦАМ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
            По месяцам (операционная деятельность)
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
                  className={`card p-4
                    ${isCurrentMonth ? 'border-brand-300 bg-brand-50/40' :
                      isFuture ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`font-bold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                      {m.monthName}
                    </span>
                    {isCurrentMonth && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-600 text-white">
                        ТЕКУЩИЙ
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        <Truck className="w-3 h-3" strokeWidth={2} />
                        Рейсов
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">{m.tripsCount || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Фрахт</span>
                      <span className="font-semibold text-green-600 break-words text-right tabular-nums">
                        {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        <Package className="w-3 h-3" strokeWidth={2} />
                        Эксп.
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">{m.forwardingCount || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Доход эксп.</span>
                      <span className="font-semibold text-green-600 break-words text-right tabular-nums">
                        {m.forwardingClientSum > 0 ? `${m.forwardingClientSum.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Маржа эксп.</span>
                      <span className="font-semibold text-emerald-600 break-words text-right tabular-nums">
                        {m.forwardingMargin !== 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Прямые / Общие</span>
                      <span className="font-medium text-slate-600 break-words text-right tabular-nums">
                        {m.directExpenses.toFixed(0)} / {m.fixedExpenses.toFixed(0)} €
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Всего расходов</span>
                      <span className="font-semibold text-red-500 break-words text-right tabular-nums">
                        {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                      <span className="font-semibold text-slate-800">Прибыль</span>
                      <span className={`font-bold text-base break-words text-right tabular-nums ${
                        isFuture ? 'text-slate-400' :
                        m.profit > 0 ? 'text-emerald-600' :
                        m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Маржа</span>
                      <span className={`font-semibold text-right tabular-nums ${
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

            <div className="bg-slate-100 rounded-2xl border-2 border-slate-200 p-4">
              <div className="font-bold text-slate-900 mb-3">ИТОГО за {year}</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 inline-flex items-center gap-1">
                    <Truck className="w-3 h-3" strokeWidth={2} />
                    Рейсов
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">{yearTotals.tripsCount}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Фрахт</span>
                  <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 inline-flex items-center gap-1">
                    <Package className="w-3 h-3" strokeWidth={2} />
                    Эксп.
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">{yearTotals.forwardingCount}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Доход эксп.</span>
                  <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Маржа эксп.</span>
                  <span className="font-bold text-emerald-600 break-words text-right tabular-nums">{yearTotals.forwardingMargin.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Всего расходов</span>
                  <span className="font-bold text-red-500 break-words text-right tabular-nums">{yearTotals.totalExpenses.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-300">
                  <span className="font-bold text-slate-800">Прибыль</span>
                  <span className={`font-bold text-lg break-words text-right tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {yearTotals.profit.toFixed(0)} €
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Маржа</span>
                  <span className={`font-bold text-right tabular-nums ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {avgMargin.toFixed(1)}%
                  </span>
                </div>
                {capexTotalForYear > 0 && (
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-300">
                    <span className="text-slate-500 text-[10px] uppercase inline-flex items-center gap-1">
                      <Briefcase className="w-3 h-3" strokeWidth={2} />
                      Инвестиции (вне P&L)
                    </span>
                    <span className="font-bold text-amber-600 break-words text-right tabular-nums">
                      {capexTotalForYear.toFixed(0)} €
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: таблица */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Месяц</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Эксп.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Доход эксп.</th>
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
                          ${isCurrentMonth ? 'bg-brand-50/50' :
                            isFuture ? 'bg-slate-50/30 text-slate-400' :
                            'hover:bg-brand-50/30'}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-800'}`}>
                              {m.monthName}
                            </span>
                            {isCurrentMonth && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white">
                                ТЕКУЩИЙ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-4 text-center font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                          {m.tripsCount > 0 ? m.tripsCount : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-green-600'}`}>
                          {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-center font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                          {m.forwardingCount > 0 ? m.forwardingCount : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-green-600'}`}>
                          {m.forwardingClientSum > 0 ? `${m.forwardingClientSum.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-emerald-600'}`}>
                          {m.forwardingMargin !== 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.directExpenses > 0 ? `${m.directExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.fixedExpenses > 0 ? `${m.fixedExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-medium tabular-nums ${isFuture ? 'text-slate-400' : 'text-red-500'}`}>
                          {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-bold tabular-nums ${
                          isFuture ? 'text-slate-400' :
                          m.profit > 0 ? 'text-emerald-600' :
                          m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                        </td>
                        <td className={`px-4 py-4 text-right font-semibold tabular-nums ${
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
                    <td className="px-4 py-4 text-center font-bold text-slate-900 tabular-nums">{yearTotals.tripsCount}</td>
                    <td className="px-4 py-4 text-right font-bold text-green-600 tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900 tabular-nums">{yearTotals.forwardingCount}</td>
                    <td className="px-4 py-4 text-right font-bold text-green-600 tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-600 tabular-nums">{yearTotals.forwardingMargin.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700 tabular-nums">{yearTotals.directExpenses.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700 tabular-nums">{yearTotals.fixedExpenses.toFixed(0)} €</td>
                    <td className="px-4 py-4 text-right font-bold text-red-500 tabular-nums">{yearTotals.totalExpenses.toFixed(0)} €</td>
                    <td className={`px-4 py-4 text-right font-bold text-lg tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {yearTotals.profit.toFixed(0)} €
                    </td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {avgMargin.toFixed(1)}%
                    </td>
                  </tr>
                  {capexTotalForYear > 0 && (
                    <tr className="bg-amber-50/50 border-t border-amber-200">
                      <td colSpan={9} className="px-4 py-3 text-right font-semibold text-amber-700 text-sm inline-flex items-center justify-end gap-1.5 w-full">
                        <Briefcase className="w-3.5 h-3.5" strokeWidth={2} />
                        Инвестиции за год (вне P&L):
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-right font-bold text-amber-600 text-base tabular-nums">
                        {capexTotalForYear.toFixed(0)} €
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ЛЕГЕНДА */}
        <div className="card p-5 md:p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Sigma className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
            Как считается
          </h3>

          <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
            {/* Левая колонка — формулы */}
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 md:p-4">
                <div className="font-semibold text-slate-800 mb-1.5">ДОХОД</div>
                <div className="text-slate-600 text-xs md:text-sm font-mono">
                  Фрахт рейсов + Доход экспедиций
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 md:p-4">
                <div className="font-semibold text-slate-800 mb-1.5">ОПЕРАЦИОННЫЕ РАСХОДЫ</div>
                <div className="text-slate-600 text-xs md:text-sm font-mono leading-relaxed">
                  Прямые расходы рейсов<br/>
                  + Подрядчики экспедиций<br/>
                  + Доп. расходы экспедиций<br/>
                  + Операционные фикс-косты
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-3 md:p-4 border border-emerald-100">
                <div className="font-semibold text-emerald-800 mb-1.5">ПРИБЫЛЬ (P&L)</div>
                <div className="text-emerald-700 text-xs md:text-sm font-mono">
                  ДОХОД − ОПЕРАЦИОННЫЕ РАСХОДЫ
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 md:p-4">
                <div className="font-semibold text-slate-800 mb-1.5">МАРЖА</div>
                <div className="text-slate-600 text-xs md:text-sm font-mono">
                  ПРИБЫЛЬ ÷ ДОХОД × 100%
                </div>
              </div>
            </div>

            {/* Правая колонка — правила */}
            <div className="space-y-3 text-sm">
              <div className="bg-brand-50 rounded-xl p-3 md:p-4">
                <div className="font-semibold text-brand-800 mb-2 text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4" strokeWidth={2.2} />
                  Правила отнесения
                </div>
                <ul className="text-brand-900 text-xs md:text-sm space-y-1.5">
                  <li>• <b>Рейс</b> → к месяцу финиша (или старта, если финиш пустой)</li>
                  <li>• <b>Экспедиция</b> → к месяцу загрузки</li>
                  <li>• <b>Годовые операционные</b> (ОС, техосмотр, страховки) → 1/12 на 12 месяцев</li>
                  <li>• <b>Инвестиции</b> → <b>вне P&L</b>, отдельный блок</li>
                </ul>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 md:p-4 border border-amber-200">
                <div className="font-semibold text-amber-800 mb-2 text-sm flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" strokeWidth={2.2} />
                  Инвестиции (вне P&L)
                </div>
                <p className="text-amber-900 text-xs md:text-sm">
                  Покупки машин, прицепов, крупное оборудование. Не вычитаются из операционной прибыли.
                  Показываются отдельным блоком под итогами года.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 md:p-4">
                <div className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
                  <Ban className="w-4 h-4" strokeWidth={2.2} />
                  Не учитываются
                </div>
                <p className="text-slate-600 text-xs md:text-sm">
                  Рейсы без даты старта и финиша (черновики) в статистику не попадают.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
