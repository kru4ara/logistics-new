import { Coins } from 'lucide-react';

export default function ForwardingEconomics({
  clientPrice,
  totalContractors,
  totalExpenses,
  margin,
  marginPct,
  showOriginal,
  originalCurrency,
  originalClientPrice,
}: {
  clientPrice: number;
  totalContractors: number;
  totalExpenses: number;
  margin: number;
  marginPct: number;
  showOriginal: boolean;
  originalCurrency: string;
  originalClientPrice: number;
}) {
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Coins className="w-5 h-5 text-brand-600" />
        Экономика
      </h2>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Клиент платит</div>
          <div className="text-xl md:text-2xl font-bold text-green-600 break-words">{clientPrice.toFixed(2)} €</div>
          {showOriginal && (
            <div className="text-xs text-slate-400 mt-1">
              ({originalClientPrice?.toFixed(2)} {originalCurrency})
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Подрядчику (сумма)</div>
          <div className="text-xl md:text-2xl font-bold text-red-500 break-words">{totalContractors.toFixed(2)} €</div>
        </div>
      </div>

      {totalExpenses > 0 && (
        <div className="mb-4 pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Доп. расходы</div>
            <div className="text-lg font-bold text-orange-600">−{totalExpenses.toFixed(2)} €</div>
          </div>
        </div>
      )}

      <div className="pt-3 border-t-2 border-slate-200">
        <div className="flex justify-between items-baseline gap-3">
          <div className="text-sm uppercase tracking-wide text-slate-500 font-bold">Наша маржа</div>
          <div className={`text-2xl md:text-3xl font-bold break-words ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {margin.toFixed(2)} €
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-1 text-right">
          {marginPct.toFixed(1)}% от суммы клиента
        </div>
      </div>
    </div>
  );
}
