import { getSessionContext } from '../lib/session';
import { can } from '../lib/roles';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/admin';
import { MonthlyBars, ExpenseDonut } from './components/DashboardCharts';
import AdminOnboardingCard from './components/AdminOnboardingCard';
import DashboardMonthStats from './components/dashboard/DashboardMonthStats';
import DashboardAttention from './components/dashboard/DashboardAttention';
import DashboardTotals from './components/dashboard/DashboardTotals';
import { CHART_PALETTE, CATEGORY_META } from '../lib/dashboard/category';
import { splitReminders } from '../lib/dashboard/reminders';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { role } = await getSessionContext();
  const userName = (await cookies()).get('user_name')?.value
    ? decodeURIComponent((await cookies()).get('user_name')!.value)
    : 'Офис';
  const adminOnboarded = (await cookies()).get('admin_onboarded')?.value === '1'; // ⬅️ НОВОЕ

  if (!can(role, 'trips.viewAll')) redirect('/driver');
  if (!can(role, 'trips.viewAll')) redirect('/login');

  const supabase = await createClient();

  // ============================================================
  // РЕЙСЫ
  // ============================================================
  const { data: trips } = await supabase
    .from('trips')
    .select('*');

  const { data: tripExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur, category');

  const expensesByTrip = tripExpenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  // ============================================================
  // ЭКСПЕДИРОВАНИЕ
  // ============================================================
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('*')
    .order('load_date', { ascending: false });

  const forwardingIds = forwarding?.map((f) => f.id) || [];

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
  // ОБЩИЕ РАСХОДЫ — с флагом is_capex
  // ============================================================
  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('amount_eur, month_key, cost_type, expense_date, is_capex, category');

  // ============================================================
  // НАПОМИНАНИЯ — для блока «Требует внимания»
  // ============================================================
  const { data: remindersRaw } = await supabase
    .from('reminders')
    .select('id, title, due_date, status')
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  const { expired, soon } = splitReminders(remindersRaw);

  // ============================================================
  // ОБЩИЕ ИТОГИ (за всё время)
  // ============================================================
  const totalTripRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalTripExpenses = tripExpenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const tripProfitTotal = totalTripRevenue - totalTripExpenses;

  const totalForwardingClient = forwarding?.reduce((sum, f) => sum + (f.client_price_eur || 0), 0) || 0;
  const totalForwardingContractor = Object.values(contractorsByForwarding).reduce((s, v) => s + v, 0);
  const totalForwardingExpenses = Object.values(expensesByForwarding).reduce((s, v) => s + v, 0);
  const forwardingMarginTotal = totalForwardingClient - totalForwardingContractor - totalForwardingExpenses;

  let totalOperationalFixedCosts = 0;
  let totalCapex = 0;
  let totalCapexCount = 0;
  fixedCosts?.forEach((fc) => {
    const amount = fc.amount_eur || 0;
    if (amount === 0) return;
    if (fc.is_capex === true) {
      totalCapex += amount;
      totalCapexCount += 1;
    } else {
      totalOperationalFixedCosts += amount;
    }
  });

  const combinedIncome = totalTripRevenue + totalForwardingClient;
  const combinedExpenses =
    totalTripExpenses +
    totalForwardingContractor +
    totalForwardingExpenses +
    totalOperationalFixedCosts;
  const combinedProfit = combinedIncome - combinedExpenses;

  // ============================================================
  // ТЕКУЩИЙ МЕСЯЦ
  // ============================================================
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const monthTrips = trips?.filter((t) => {
    if (!t.start_date) return false;
    const d = new Date(t.start_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthTripRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const monthTripExpenses = monthTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);

  const monthForwarding = forwarding?.filter((f) => {
    if (!f.load_date) return false;
    const d = new Date(f.load_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthForwardingClient = monthForwarding.reduce((sum, f) => sum + (f.client_price_eur || 0), 0);
  const monthForwardingContractor = monthForwarding.reduce(
    (sum, f) => sum + (contractorsByForwarding[f.id] || 0), 0
  );
  const monthForwardingExpenses = monthForwarding.reduce(
    (sum, f) => sum + (expensesByForwarding[f.id] || 0), 0
  );

  let monthFixedCosts = 0;
  fixedCosts?.forEach((fc) => {
    const amount = fc.amount_eur || 0;
    if (amount === 0) return;
    if (fc.is_capex === true) return;

    if (fc.cost_type === 'yearly') {
      let startDate: Date | null = null;
      if (fc.expense_date) startDate = new Date(fc.expense_date);
      else if (fc.month_key) startDate = new Date(fc.month_key + '-01');
      if (!startDate) return;

      const monthlyPart = amount / 12;
      const currentDate = new Date(currentYear, currentMonth, 1);
      const diffMonths =
        (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
        (currentDate.getMonth() - startDate.getMonth());

      if (diffMonths >= 0 && diffMonths < 12) {
        monthFixedCosts += monthlyPart;
      }
    } else {
      if (fc.month_key === currentMonthKey) {
        monthFixedCosts += amount;
      }
    }
  });

  const monthTotalIncome = monthTripRevenue + monthForwardingClient;
  const monthTotalExpenses =
    monthTripExpenses +
    monthForwardingContractor +
    monthForwardingExpenses +
    monthFixedCosts;
  const monthTotalProfit = monthTotalIncome - monthTotalExpenses;

  // ============================================================
  // ГРАФИК 12 МЕСЯЦЕВ — капекс ИГНОРИРУЕМ
  // ============================================================
  const monthlyData: { key: string; label: string; profit: number }[] = [];

  // Фиксируем текущую дату в UTC, чтобы сервер и клиент считали одинаково
  const nowUtc = new Date();
  const currentYearUtc = nowUtc.getUTCFullYear();
  const currentMonthUtc = nowUtc.getUTCMonth();

  const monthNamesShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  for (let i = 11; i >= 0; i--) {
    // Вычисляем год и месяц арифметически, без Date
    let y = currentYearUtc;
    let m = currentMonthUtc - i;

    while (m < 0) {
      m += 12;
      y -= 1;
    }

    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = monthNamesShort[m];

    let income = 0;
    let expenses = 0;

    trips?.forEach((t) => {
      const dateStr = t.end_date || t.start_date;
      if (!dateStr) return;
      const td = new Date(dateStr);
      if (td.getUTCFullYear() !== y || td.getUTCMonth() !== m) return;
      income += t.revenue_eur || 0;
      expenses += expensesByTrip[t.id] || 0;
    });

    forwarding?.forEach((f) => {
      if (!f.load_date) return;
      const fd = new Date(f.load_date);
      if (fd.getUTCFullYear() !== y || fd.getUTCMonth() !== m) return;
      income += f.client_price_eur || 0;
      expenses += (contractorsByForwarding[f.id] || 0) + (expensesByForwarding[f.id] || 0);
    });

    fixedCosts?.forEach((fc) => {
      const amount = fc.amount_eur || 0;
      if (amount === 0) return;
      if (fc.is_capex === true) return;

      if (fc.cost_type === 'yearly') {
        let startDate: Date | null = null;
        if (fc.expense_date) startDate = new Date(fc.expense_date);
        else if (fc.month_key) startDate = new Date(fc.month_key + '-01');
        if (!startDate) return;
        const monthlyPart = amount / 12;
        
        // Сравниваем без Date (чистая арифметика)
        const startY = startDate.getUTCFullYear();
        const startM = startDate.getUTCMonth();
        const diffMonths = (y - startY) * 12 + (m - startM);
        
        if (diffMonths >= 0 && diffMonths < 12) {
          expenses += monthlyPart;
        }
      } else {
        if (fc.month_key === key) {
          expenses += amount;
        }
      }
    });

    monthlyData.push({ key, label, profit: Math.round(income - expenses) });
  }
  // ============================================================
  // DONUT
  // ============================================================
  const catAgg: Record<string, number> = {};
  tripExpenses?.forEach((e) => {
    const cat = e.category || 'other';
    const amount = e.amount_eur || 0;
    if (amount <= 0) return;
    catAgg[cat] = (catAgg[cat] || 0) + amount;
  });

  const sortedCats = Object.entries(catAgg)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const donutData = sortedCats.map(([key, amount], idx) => ({
    key,
    label: CATEGORY_META[key]?.label || key,
    emoji: CATEGORY_META[key]?.emoji || '📌',
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
    amount,
  }));

  const donutTotal = donutData.reduce((s, c) => s + c.amount, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* ПРИВЕТСТВИЕ */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words">
            Привет, {userName} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Обзор вашей логистики за {monthName}
          </p>
        </div>

        {/* 🆕 ОНБОРДИНГ АДМИНА — показывается только в первый раз */}
        {!adminOnboarded && (
          <AdminOnboardingCard userName={userName} />
        )}

        <DashboardMonthStats
          monthName={monthName}
          tripsCount={monthTrips.length}
          forwardingCount={monthForwarding.length}
          totalIncome={monthTotalIncome}
          totalExpenses={monthTotalExpenses}
          totalProfit={monthTotalProfit}
          tripRevenue={monthTripRevenue}
          tripExpenses={monthTripExpenses}
          forwardingClient={monthForwardingClient}
          forwardingContractor={monthForwardingContractor}
          forwardingExpenses={monthForwardingExpenses}
          fixedCosts={monthFixedCosts}
        />

        <DashboardAttention expired={expired} soon={soon} />

        <DashboardTotals
          combinedIncome={combinedIncome}
          combinedExpenses={combinedExpenses}
          combinedProfit={combinedProfit}
          tripProfitTotal={tripProfitTotal}
          forwardingMarginTotal={forwardingMarginTotal}
          totalOperationalFixedCosts={totalOperationalFixedCosts}
          totalCapex={totalCapex}
          totalCapexCount={totalCapexCount}
        />

        {/* ГРАФИКИ */}
        <MonthlyBars data={monthlyData} />
        <ExpenseDonut data={donutData} total={donutTotal} />

      </div>
    </main>
  );
}
