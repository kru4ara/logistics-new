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
import { getOrderUnloadDate } from '../lib/orders-core';
import { isStatsCompleted } from '../lib/statistics';

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
  // ============================================================
  // ЗАКАЗЫ (единая модель: рейсы + экспедирование)
  // ============================================================
  const { data: trips } = await supabase
    .from('trips')
    .select(
      'id, client_id, revenue_eur, start_date, end_date, load_date, unload_date, status, profit_mode, is_forwarding, costs_closed'
    );

  const { data: tripExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur, category');

  // Расходы делим на две части:
  //   подрядчик — запись в trip_expenses с category='contractor'
  //   прочие    — всё остальное
  // Подрядчик НЕ берём из trip_segments.price: эта же сумма уже лежит
  // в расходах, и при сложении она учитывалась дважды.
  const contractorByTrip: Record<string, number> = {};
  const otherExpensesByTrip: Record<string, number> = {};
  tripExpenses?.forEach((e) => {
    if (!e.trip_id) return;
    const amount = e.amount_eur || 0;
    if (e.category === 'contractor') {
      contractorByTrip[e.trip_id] = (contractorByTrip[e.trip_id] || 0) + amount;
    } else {
      otherExpensesByTrip[e.trip_id] = (otherExpensesByTrip[e.trip_id] || 0) + amount;
    }
  });

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
  // ВСПОМОГАТЕЛЬНОЕ
  // ============================================================
  const isForwardingOrder = (o: any) => o?.profit_mode === 'forwarding';

  /** Месяц заказа — ПО ДАТЕ ВЫГРУЗКИ:
   *  рейс — финиш, экспедиция — разгрузка.
   *  Загружен в сентябре, выгружен в октябре — заказ октябрьский. */
  const orderMonthKey = (o: any): string | null => {
    const raw = getOrderUnloadDate(o);
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  };

  const orderRevenue = (o: any) => o?.revenue_eur || 0;
  const orderDirectExpenses = (o: any) => otherExpensesByTrip[o.id] || 0;
  const orderContractorExpenses = (o: any) => contractorByTrip[o.id] || 0;
  const orderAllExpenses = (o: any) =>
    orderDirectExpenses(o) + orderContractorExpenses(o);

  // ============================================================
  // ОБЩИЕ ИТОГИ (за всё время)
  // ============================================================
  // Итоги, месяц и график — только по ЗАВЕРШЁННЫМ заказам
  // (paid/invoiced + сведённые расходы + есть дата выгрузки).
  // Заказы в пути и без даты выгрузки в статистику не идут.
  const allOrders = (trips || []).filter((o) => isStatsCompleted(o));

  const tripOrders = allOrders.filter((o) => !isForwardingOrder(o));
  const fwdOrders = allOrders.filter((o) => isForwardingOrder(o));

  const totalTripRevenue = tripOrders.reduce((sum, o) => sum + orderRevenue(o), 0);
  // Расходы рейса = прочие прямые + подрядчик (подрядчик — одна запись
  // в trip_expenses, дублировать нельзя).
  const totalTripExpenses = tripOrders.reduce(
    (sum, o) => sum + orderDirectExpenses(o) + orderContractorExpenses(o),
    0
  );
  const tripProfitTotal = totalTripRevenue - totalTripExpenses;

  const totalForwardingClient = fwdOrders.reduce((sum, o) => sum + orderRevenue(o), 0);
  const totalForwardingContractor = fwdOrders.reduce(
    (sum, o) => sum + orderContractorExpenses(o),
    0
  );
  // Прочие расходы экспедирований (без подрядчика).
  const totalForwardingExpenses = fwdOrders.reduce(
    (sum, o) => sum + orderDirectExpenses(o),
    0
  );
  const forwardingMarginTotal =
    totalForwardingClient - totalForwardingContractor - totalForwardingExpenses;

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

  const monthOrders = allOrders.filter((o) => orderMonthKey(o) === currentMonthKey);
  const monthTrips = monthOrders.filter((o) => !isForwardingOrder(o));
  const monthForwarding = monthOrders.filter((o) => isForwardingOrder(o));

  const monthTripRevenue = monthTrips.reduce((sum, o) => sum + orderRevenue(o), 0);
  const monthTripExpenses = monthTrips.reduce(
    (sum, o) => sum + orderDirectExpenses(o) + orderContractorExpenses(o),
    0
  );

  const monthForwardingClient = monthForwarding.reduce((sum, o) => sum + orderRevenue(o), 0);
  const monthForwardingContractor = monthForwarding.reduce(
    (sum, o) => sum + orderContractorExpenses(o),
    0
  );
  const monthForwardingExpenses = monthForwarding.reduce(
    (sum, o) => sum + orderDirectExpenses(o),
    0
  );

  // Годовые затраты падают ЦЕЛИКОМ в месяц оплаты (не 1/12).
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

      const mk =
        startDate.getFullYear() + '-' + String(startDate.getMonth() + 1).padStart(2, '0');
      if (mk === currentMonthKey) {
        monthFixedCosts += amount;
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

    allOrders.forEach((o) => {
      if (orderMonthKey(o) !== key) return;
      income += orderRevenue(o);
      expenses += orderAllExpenses(o);
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

        const startY = startDate.getFullYear();
        const startM = startDate.getMonth();
        const mk = `${startY}-${String(startM + 1).padStart(2, '0')}`;

        if (mk === key) {
          expenses += amount;
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
