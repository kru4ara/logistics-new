import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
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
  // ЗАГРУЗКА ДАННЫХ
  // ============================================================
  
  // 1. Рейсы
  const { data: trips } = await supabase
    .from('trips')
    .select('id, revenue_eur, start_date, end_date, status');

  const tripIds = trips?.map((t) => t.id) || [];

  // 2. Расходы рейсов
  let allExpenses: any[] = [];
  if (tripIds.length > 0) {
    const { data } = await supabase.from('trip_expenses').select('amount_eur, trip_id');
    allExpenses = data || [];
  }

  // 3. Фикс-косты
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('id, amount_eur, month_key, cost_type, expense_date, category, currency, is_capex');

  // 4. Экспедирование
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_price_eur, load_date, unload_date, status');

  const forwardingIds = forwarding?.map((f) => f.id) || [];

  // 5. Подрядчики экспедиций
  const contractorsByForwarding: Record<string, number> = {};
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

  // 6. Расходы экспедиций
  const expensesByForwarding: Record<string, number> = {};
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
    trips,
    allExpenses,
    fixedCosts,
    forwarding,
    contractorsByForwarding,
    expensesByForwarding,
    year,
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ============================================================
  // ГОДЫ ДЛЯ ФИЛЬТРА
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
