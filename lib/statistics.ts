export type MonthData = {
  month: number;
  monthName: string;
  monthKey: string;
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

export function getTripMonthKey(trip: any): string | null {
  const date = trip.end_date || trip.start_date;
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getForwardingMonthKey(f: any): string | null {
  const date = f.load_date || f.unload_date;
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calculateStatistics({
  trips,
  allExpenses,
  fixedCosts,
  forwarding,
  contractorsByForwarding,
  expensesByForwarding,
  year,
}: {
  trips: any[] | null;
  allExpenses: any[];
  fixedCosts: any[] | null;
  forwarding: any[] | null;
  contractorsByForwarding: Record<string, number>;
  expensesByForwarding: Record<string, number>;
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
  // 1. Рейсы → месяцы
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

  // 2. Фикс-косты
  const fixedCostsByMonth: Record<string, number> = {};
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
    .filter((c) => new Date(c.date).getFullYear() === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const capexTotalForYear = capexForYear.reduce((s, c) => s + c.amount_eur, 0);

  // 3. Экспедиция → месяцы
  const forwardingByMonth: Record<string, any[]> = {};
  forwarding?.forEach((f) => {
    const mk = getForwardingMonthKey(f);
    if (!mk) return;
    if (!forwardingByMonth[mk]) forwardingByMonth[mk] = [];
    forwardingByMonth[mk].push(f);
  });

  // 4. Сборка 12 месяцев
  const months: MonthData[] = [];
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
    const totalExpenses = directExpenses + forwardingContractorSum + forwardingExtraExpenses + fixedExpenses;
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

  return { months, yearTotals, capexForYear, capexTotalForYear, avgMargin, tripProfit, avgProfitPerTrip };
}
