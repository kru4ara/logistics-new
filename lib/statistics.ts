import {
  getOrderMonthKey,
  isOrderCompleted,
  num,
  type ProfitMode,
} from './orders-core';

export type MonthData = {
  month: number;
  monthName: string;
  monthKey: string;
  /** Всего завершённых заказов в месяце (рейсы + экспедиции). */
  ordersCount: number;
  tripsCount: number;
  tripRevenue: number;
  directExpenses: number;
  forwardingCount: number;
  forwardingClientSum: number;
  forwardingContractorSum: number;
  forwardingExtraExpenses: number;
  forwardingMargin: number;
  fixedExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  margin: number;
};

export type YearTotals = {
  ordersCount: number;
  tripsCount: number;
  tripRevenue: number;
  directExpenses: number;
  forwardingCount: number;
  forwardingClientSum: number;
  forwardingContractorSum: number;
  forwardingExtraExpenses: number;
  forwardingMargin: number;
  fixedExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
};

export type CapexItem = {
  id: string;
  category: string;
  amount_eur: number;
  currency: string;
  date: string;
  month_key: string | null;
};

/**
 * Месяц заказа. Режим расчёта задаёт правило:
 *   trip       -> end_date || start_date (финиш)
 *   forwarding -> unload_date || load_date (разгрузка)
 */
export function getOrderMonthKeyForStats(order: any): string | null {
  return getOrderMonthKey(
    {
      profit_mode: (order?.profit_mode as ProfitMode) ?? 'trip',
      start_date: order?.start_date,
      end_date: order?.end_date,
      load_date: order?.load_date,
      unload_date: order?.unload_date,
    },
    'trip'
  );
}

/**
 * Заказ попадает в статистику, только если он завершён
 * (paid/invoiced) и по нему сведены расходы.
 */
export function isStatsCompleted(order: any): boolean {
  return isOrderCompleted({
    status: order?.status,
    costs_closed: order?.costs_closed,
  });
}

/**
 * Общие затраты по месяцам.
 * Годовая сумма падает ЦЕЛИКОМ в месяц оплаты, а не размазывается на 1/12.
 * CAPEX в прибыль не входит — он собирается отдельно.
 */
export function buildFixedCostsByMonth(
  fixedCosts: any[] | null,
  year: number
): { byMonth: Record<string, number>; capexAll: CapexItem[] } {
  const byMonth: Record<string, number> = {};
  const capexAll: CapexItem[] = [];

  fixedCosts?.forEach((fc) => {
    const amount = num(fc.amount_eur);
    if (amount === 0) return;

    if (fc.is_capex === true) {
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
      // Годовая стоимость целиком в месяц оплаты.
      const dateStr = fc.expense_date || (fc.month_key ? fc.month_key + '-01' : null);
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const mk =
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      byMonth[mk] = (byMonth[mk] || 0) + amount;
      return;
    }

    if (fc.month_key) {
      byMonth[fc.month_key] = (byMonth[fc.month_key] || 0) + amount;
    }
  });

  return { byMonth, capexAll };
}

/**
 * Единый расчёт статистики по заказам.
 *
 * Математика:
 *   общая выручка = выручка рейсов + выручка экспедиций
 *   общие расходы = прямые расходы + подрядчики + доп. расходы + общие затраты
 *   чистая прибыль = общая выручка − общие расходы (без CAPEX)
 */
export function calculateStatistics({
  orders,
  expensesByOrder,
  contractorByOrder,
  fixedCosts,
  year,
}: {
  orders: any[] | null;
  expensesByOrder: Record<string, number>;
  contractorByOrder: Record<string, number>;
  fixedCosts: any[] | null;
  year: number;
}): {
  months: MonthData[];
  yearTotals: YearTotals;
  capexForYear: CapexItem[];
  capexTotalForYear: number;
  avgMargin: number;
  tripProfit: number;
  avgProfitPerTrip: number;
} {
  const { byMonth: fixedByMonth, capexAll } = buildFixedCostsByMonth(fixedCosts, year);

  const completed = (orders || []).filter(isStatsCompleted);

  const ordersByMonth: Record<string, any[]> = {};
  completed.forEach((o) => {
    const mk = getOrderMonthKeyForStats(o);
    if (!mk) return;
    if (!ordersByMonth[mk]) ordersByMonth[mk] = [];
    ordersByMonth[mk].push(o);
  });

  const capexForYear = capexAll
    .filter((c) => new Date(c.date).getFullYear() === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const capexTotalForYear = capexForYear.reduce((s, c) => s + c.amount_eur, 0);

  const months: MonthData[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = year + '-' + String(m).padStart(2, '0');

    const monthOrders = ordersByMonth[monthKey] || [];
    const ordersCount = monthOrders.length;

    let tripRevenue = 0;
    let directExpenses = 0;
    let tripsCount = 0;
    let forwardingClientSum = 0;
    let forwardingContractorSum = 0;
    let forwardingExtraExpenses = 0;
    let forwardingCount = 0;

    monthOrders.forEach((o) => {
      const revenue = num(o.revenue_eur);
      const mode: ProfitMode = o.profit_mode === 'forwarding' ? 'forwarding' : 'trip';
      const otherExpenses = num(expensesByOrder[o.id]);
      const contractorExpenses = num(contractorByOrder[o.id]);

      if (mode === 'forwarding') {
        forwardingCount += 1;
        forwardingClientSum += revenue;
        forwardingContractorSum += contractorExpenses;
        forwardingExtraExpenses += otherExpenses;
      } else {
        tripsCount += 1;
        tripRevenue += revenue;
        // Подрядчик в рейсе — тоже расход: раньше он не вычитался,
        // и прибыль рейсов была завышена.
        directExpenses += otherExpenses + contractorExpenses;
      }
    });

    const forwardingMargin =
      forwardingClientSum - forwardingContractorSum - forwardingExtraExpenses;
    const fixedExpenses = fixedByMonth[monthKey] || 0;

    const totalIncome = tripRevenue + forwardingClientSum;
    const totalExpenses =
      directExpenses + forwardingContractorSum + forwardingExtraExpenses + fixedExpenses;
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    months.push({
      month: m,
      monthName: new Date(year, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }),
      monthKey,
      ordersCount, tripsCount, tripRevenue, directExpenses,
      forwardingCount, forwardingClientSum, forwardingContractorSum,
      forwardingExtraExpenses, forwardingMargin,
      fixedExpenses, totalIncome, totalExpenses, profit, margin,
    });
  }

  const yearTotals = months.reduce(
    (acc, m) => ({
      ordersCount: acc.ordersCount + m.ordersCount,
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
      ordersCount: 0, tripsCount: 0, tripRevenue: 0, directExpenses: 0,
      forwardingCount: 0, forwardingClientSum: 0, forwardingContractorSum: 0,
      forwardingExtraExpenses: 0, forwardingMargin: 0,
      fixedExpenses: 0, totalIncome: 0, totalExpenses: 0, profit: 0,
    }
  );

  const avgMargin =
    yearTotals.totalIncome > 0 ? (yearTotals.profit / yearTotals.totalIncome) * 100 : 0;
  const tripProfit = yearTotals.tripRevenue - yearTotals.directExpenses;
  const avgProfitPerTrip = yearTotals.tripsCount > 0 ? tripProfit / yearTotals.tripsCount : 0;

  return {
    months, yearTotals, capexForYear, capexTotalForYear,
    avgMargin, tripProfit, avgProfitPerTrip,
  };
}
