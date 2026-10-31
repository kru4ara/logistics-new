import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { calculateStatistics } from '../../lib/statistics';
import StatisticsHeader from './StatisticsHeader';
import StatisticsSummary from './StatisticsSummary';
import StatisticsBreakdown from './StatisticsBreakdown';
import StatisticsCapex from './StatisticsCapex';
import StatisticsTable from './StatisticsTable';
import StatisticsLegend from './StatisticsLegend';

export const dynamic = 'force-dynamic';

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  const resolvedParams = await searchParams;
  const supabase = await createClient();

  const currentYear = new Date().getFullYear();
  const year = parseInt(resolvedParams?.year || String(currentYear));

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ — единый источник «заказы»
  // ============================================================

  // 1. Все заказы (рейсы + экспедиции) одним запросом
  const { data: orders } = await supabase
    .from('trips')
    .select(
      'id, revenue_eur, start_date, end_date, load_date, unload_date, status, profit_mode, is_forwarding, costs_closed'
    );

  const orderIds = orders?.map((o) => o.id) || [];

  // 2. Расходы заказов.
  // Подрядчик НЕ дублируется: сумма подрядчика живёт в trip_expenses
  // (категория 'contractor') и автоматически создаётся из сегмента.
  // Если считать подрядчика ещё и в trip_segments.price, он вычтется дважды.
  const expensesByOrder: Record<string, number> = {};
  const contractorByOrder: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: allExpenses } = await supabase
      .from('trip_expenses')
      .select('amount_eur, trip_id, category');
    allExpenses?.forEach((e) => {
      if (!e.trip_id) return;
      const amount = e.amount_eur || 0;
      if (e.category === 'contractor') {
        contractorByOrder[e.trip_id] = (contractorByOrder[e.trip_id] || 0) + amount;
      } else {
        expensesByOrder[e.trip_id] = (expensesByOrder[e.trip_id] || 0) + amount;
      }
    });
  }

  // 4. Фикс-косты
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('id, amount_eur, month_key, cost_type, expense_date, category, currency, is_capex');

  // ============================================================
  // РАСЧЁТЫ (вынесены в lib/statistics.ts)
  // ============================================================
  const {
    months,
    yearTotals,
    capexForYear,
    capexTotalForYear,
    avgMargin,
    tripProfit,
    avgProfitPerTrip,
  } = calculateStatistics({
    orders,
    expensesByOrder,
    contractorByOrder,
    fixedCosts,
    year,
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ============================================================
  // ГОДЫ ДЛЯ ФИЛЬТРА
  // ============================================================
  const yearsSet = new Set<number>();
  yearsSet.add(currentYear);
  orders?.forEach((o) => {
    const d = o.end_date || o.start_date || o.load_date || o.unload_date;
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

  // ============================================================
  // РЕНДЕР
  // ============================================================
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <StatisticsHeader year={year} years={years} />

        <StatisticsSummary
          year={year}
          yearTotals={yearTotals}
          avgMargin={avgMargin}
          capexTotalForYear={capexTotalForYear}
          capexCount={capexForYear.length}
        />

        <StatisticsBreakdown
          yearTotals={yearTotals}
          tripProfit={tripProfit}
          avgProfitPerTrip={avgProfitPerTrip}
        />

        <StatisticsCapex
          year={year}
          capexForYear={capexForYear}
          capexTotalForYear={capexTotalForYear}
        />

        <StatisticsTable
          year={year}
          months={months}
          yearTotals={yearTotals}
          currentMonthKey={currentMonthKey}
          avgMargin={avgMargin}
          capexTotalForYear={capexTotalForYear}
        />

        <StatisticsLegend />

      </div>
    </main>
  );
}
