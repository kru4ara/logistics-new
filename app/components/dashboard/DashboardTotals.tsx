import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Wallet,
  Briefcase,
} from 'lucide-react';

type Props = {
  combinedIncome: number;
  combinedExpenses: number;
  combinedProfit: number;
  tripProfitTotal: number;
  forwardingMarginTotal: number;
  totalOperationalFixedCosts: number;
  totalCapex: number;
  totalCapexCount: number;
};

/** Итоги за всё время. */
export default function DashboardTotals({
  combinedIncome,
  combinedExpenses,
  combinedProfit,
  tripProfitTotal,
  forwardingMarginTotal,
  totalOperationalFixedCosts,
  totalCapex,
  totalCapexCount,
}: Props) {
  return (
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
  );
}
