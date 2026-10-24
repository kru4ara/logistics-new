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

// ... (сюда переносим getTripMonthKey, getForwardingMonthKey, 
// расчёт фикс-костов, сборку месяцев и yearTotals)
