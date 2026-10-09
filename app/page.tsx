import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase-server';
import { MonthlyBars, ExpenseDonut } from './components/DashboardCharts';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Wallet,
  Briefcase,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const CHART_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  fuel: { label: 'Топливо', emoji: '⛽' },
  salary: { label: 'ЗП водителя', emoji: '💶' },
  contractor: { label: 'Подрядчик', emoji: '🚛' },
  border: { label: 'Граница', emoji: '🛂' },
  permit: { label: 'Дозвол', emoji: '📋' },
  tlc: { label: 'ТЛЦ', emoji: '🏭' },
  waiting: { label: 'Зона ожидания', emoji: '⏳' },
  repair: { label: 'Ремонт', emoji: '🔧' },
  parking: { label: 'Паркинг', emoji: '🅿️' },
  disinfection: { label: 'Дезинфекция', emoji: '🧴' },
  ex1: { label: 'ЕХ-1', emoji: '🧾' },
  otkat: { label: 'Откат', emoji: '🔄' },
  gps_seal: { label: 'GPS пломба', emoji: '📡' },
  epi: { label: 'EPI', emoji: '📄' },
  etoll: { label: 'e-TOLL', emoji: '🛣' },
  other: { label: 'Другое', emoji: '📌' },
};

function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  return Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function Home() {
  const role = cookies().get('role')?.value;
  const userName = cookies().get('user_name')?.value
    ? decodeURIComponent(cookies().get('user_name')!.value)
    : 'Офис';

  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  // ============================================================
  // РЕЙСЫ
  // ============================================================
  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .order('trip_number', { ascending: false });

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

  const expiredReminders: { id: string; title: string; days: number }[] = [];
  const soonReminders: { id: string; title: string; days: number }[] = [];

  remindersRaw?.forEach((r) => {
    const d = daysUntil(r.due_date);
    if (d === null) return;
    if (d < 0) expiredReminders.push({ id: r.id, title: r.title || '', days: d });
    else if (d <= 7) soonReminders.push({ id: r.id, title: r.title || '', days: d });
  });

  const hasAttention = expiredReminders.length > 0 || soonReminders.length > 0;

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

  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');

    let income = 0;
    let expenses = 0;

    trips?.forEach((t) => {
      const dateStr = t.end_date || t.start_date;
      if (!dateStr) return;
      const td = new Date(dateStr);
      if (td.getFullYear() !== y || td.getMonth() !== m) return;
      income += t.revenue_eur || 0;
      expenses += expensesByTrip[t.id] || 0;
    });

    forwarding?.forEach((f) => {
      if (!f.load_date) return;
      const fd = new Date(f.load_date);
      if (fd.getFullYear() !== y || fd.getMonth() !== m) return;
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
        const targetDate = new Date(y, m, 1);
        const diffMonths =
          (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
          (targetDate.getMonth() - startDate.getMonth());
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

        {/* ПОКАЗАТЕЛИ ЗА МЕСЯЦ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            Показатели за {monthName}
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
            <div className="card card-hover p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Сделок</span>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 md:w-[18px] md:h-[18px] text-brand-600" strokeWidth={2} />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
                {monthTrips.length + monthForwarding.length}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 inline-flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-0.5">
                  <Truck className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{monthTrips.length}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Package className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{monthForwarding.length}</span>
                </span>
              </div>
            </div>

            <div className="card card-hover p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Доход</span>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 md:w-[18px] md:h-[18px] text-green-600" strokeWidth={2} />
                </div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
                {monthTotalIncome.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Фрахт: {monthTripRevenue.toFixed(0)} · Эксп.: {monthForwardingClient.toFixed(0)}
              </div>
            </div>

            <div className="card card-hover p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Расходы</span>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 md:w-[18px] md:h-[18px] text-red-500" strokeWidth={2} />
                </div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
                {monthTotalExpenses.toFixed(0)} €
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Рейсы: {monthTripExpenses.toFixed(0)} · Эксп.: {(monthForwardingContractor + monthForwardingExpenses).toFixed(0)} · Фикс.: {monthFixedCosts.toFixed(0)}
              </div>
            </div>

            <div className="card card-hover p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль</span>
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center ${monthTotalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <Wallet className={`w-4 h-4 md:w-[18px] md:h-[18px] ${monthTotalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} strokeWidth={2} />
                </div>
              </div>
              <div className={`text-xl md:text-2xl font-bold break-words tabular-nums ${monthTotalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {monthTotalProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* ТРЕБУЕТ ВНИМАНИЯ */}
        {hasAttention && (
          <div className="card border-l-4 border-l-amber-500 p-4 md:p-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
                Требует внимания
              </h2>
              <a
                href="/reminders"
                className="text-sm text-brand-600 hover:underline font-medium whitespace-nowrap self-start sm:self-auto"
              >
                Все напоминания →
              </a>
            </div>

            <div className="space-y-3">
              {expiredReminders.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-1.5">
                    Просрочено · {expiredReminders.length}
                  </div>
                  <div className="space-y-1">
                    {expiredReminders.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-red-600 whitespace-nowrap tabular-nums">
                          {Math.abs(r.days)} дн.
                        </span>
                      </div>
                    ))}
                    {expiredReminders.length > 3 && (
                      <div className="text-xs text-slate-400 pl-4">
                        ...и ещё {expiredReminders.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {soonReminders.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-1.5">
                    Скоро (≤7 дней) · {soonReminders.length}
                  </div>
                  <div className="space-y-1">
                    {soonReminders.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap tabular-nums">
                          {r.days} дн.
                        </span>
                      </div>
                    ))}
                    {soonReminders.length > 3 && (
                      <div className="text-xs text-slate-400 pl-4">
                        ...и ещё {soonReminders.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ОБЩИЕ ЗА ВСЁ ВРЕМЯ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            За всё время
          </h2>
          <div className={`grid gap-3 md:gap-4 grid-cols-2 ${totalCapex > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-lg shadow-green-500/20 p-4 md:p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs md:text-sm text-green-100">Общий доход</span>
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-100" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold break-words tabular-nums">{combinedIncome.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-green-200 mt-1">Рейсы + Эксп.</div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl shadow-lg shadow-red-500/20 p-4 md:p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs md:text-sm text-red-100">Опер. расходы</span>
                <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-100" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold break-words tabular-nums">{combinedExpenses.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-red-200 mt-1">Прямые + Эксп. + Фикс.</div>
            </div>

            <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl shadow-lg shadow-violet-500/20 p-4 md:p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs md:text-sm text-violet-100">Экспедирование</span>
                <Package className="w-4 h-4 md:w-5 md:h-5 text-violet-100" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold break-words tabular-nums">{forwardingMarginTotal.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-violet-200 mt-1">Маржа за всё время</div>
            </div>

            <div className={`bg-gradient-to-br ${combinedProfit >= 0 ? 'from-brand-600 to-brand-800 shadow-brand-lg' : 'from-red-600 to-red-800 shadow-red-500/20'} rounded-2xl shadow-lg p-4 md:p-5 text-white`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs md:text-sm ${combinedProfit >= 0 ? 'text-brand-100' : 'text-red-100'}`}>Чистая прибыль</span>
                <Wallet className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold break-words tabular-nums">{combinedProfit.toFixed(0)} €</div>
              <div className={`text-[10px] md:text-xs ${combinedProfit >= 0 ? 'text-brand-200' : 'text-red-200'} mt-1 break-words inline-flex items-center flex-wrap gap-1`}>
                <span className="inline-flex items-center gap-0.5">
                  <Truck className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{tripProfitTotal.toFixed(0)}</span>
                </span>
                <span>+</span>
                <span className="inline-flex items-center gap-0.5">
                  <Package className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{forwardingMarginTotal.toFixed(0)}</span>
                </span>
                <span>−</span>
                <span className="inline-flex items-center gap-0.5">
                  <Briefcase className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{totalOperationalFixedCosts.toFixed(0)}</span>
                </span>
              </div>
            </div>

            {totalCapex > 0 && (
              <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-lg shadow-amber-500/20 p-4 md:p-5 text-white col-span-2 md:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs md:text-sm text-amber-100">Инвестиции</span>
                  <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-amber-100" strokeWidth={2} />
                </div>
                <div className="text-xl md:text-2xl font-bold break-words tabular-nums">{totalCapex.toFixed(0)} €</div>
                <div className="text-[10px] md:text-xs text-amber-200 mt-1">вне P&L · {totalCapexCount} оп.</div>
              </div>
            )}
          </div>
        </div>

        {/* ГРАФИКИ */}
        <MonthlyBars data={monthlyData} />
        <ExpenseDonut data={donutData} total={donutTotal} />

      </div>
    </main>
  );
}
