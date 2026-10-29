import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Wallet,
  BarChart3,
} from 'lucide-react';

type Props = {
  monthName: string;
  tripsCount: number;
  forwardingCount: number;
  totalIncome: number;
  totalExpenses: number;
  totalProfit: number;
  tripRevenue: number;
  tripExpenses: number;
  forwardingClient: number;
  forwardingContractor: number;
  forwardingExpenses: number;
  fixedCosts: number;
};

/** Показатели за текущий месяц: сделки, доход, расходы, прибыль. */
export default function DashboardMonthStats({
  monthName,
  tripsCount,
  forwardingCount,
  totalIncome,
  totalExpenses,
  totalProfit,
  tripRevenue,
  tripExpenses,
  forwardingClient,
  forwardingContractor,
  forwardingExpenses,
  fixedCosts,
}: Props) {
  return (
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
        {tripsCount + forwardingCount}
      </div>
      <div className="text-[10px] md:text-xs text-slate-400 mt-1 inline-flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-0.5">
          <Truck className="w-3 h-3" strokeWidth={2} />
          <span className="tabular-nums">{tripsCount}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-0.5">
          <Package className="w-3 h-3" strokeWidth={2} />
          <span className="tabular-nums">{forwardingCount}</span>
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
        {totalIncome.toFixed(0)} €
      </div>
      <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
        Фрахт: {tripRevenue.toFixed(0)} · Эксп.: {forwardingClient.toFixed(0)}
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
        {totalExpenses.toFixed(0)} €
      </div>
      <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
        Рейсы: {tripExpenses.toFixed(0)} · Эксп.: {(forwardingContractor + forwardingExpenses).toFixed(0)} · Фикс.: {fixedCosts.toFixed(0)}
      </div>
    </div>

    <div className="card card-hover p-4 md:p-5">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль</span>
        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center ${totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <Wallet className={`w-4 h-4 md:w-[18px] md:h-[18px] ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} strokeWidth={2} />
        </div>
      </div>
      <div className={`text-xl md:text-2xl font-bold break-words tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {totalProfit.toFixed(0)} €
      </div>
    </div>
  </div>
</div>
  );
}
