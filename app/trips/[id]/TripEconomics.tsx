import { Wallet, Coins } from 'lucide-react';

export default function TripEconomics({
  trip,
  contractorExpenses,
  otherExpenses,
  profit,
}: {
  trip: any;
  contractorExpenses: number;
  otherExpenses: number;
  profit: number;
}) {
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-brand-600" strokeWidth={2} />
        Экономика рейса
      </h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="text-sm font-medium text-slate-700">Фрахт</div>
          <div className="text-lg font-bold text-green-600 tabular-nums">
            {(trip.revenue_eur || 0).toFixed(2)} €
          </div>
        </div>

        {contractorExpenses > 0 && (
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Coins className="w-4 h-4 text-slate-400" strokeWidth={2} />
              Подрядчики
            </div>
            <div className="text-lg font-bold text-red-600 tabular-nums">
              −{contractorExpenses.toFixed(2)} €
            </div>
          </div>
        )}

        {otherExpenses > 0 && (
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-700">Прочие расходы</div>
            <div className="text-lg font-bold text-red-600 tabular-nums">
              −{otherExpenses.toFixed(2)} €
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-base font-bold text-slate-900">Прибыль</div>
          <div className={`text-2xl font-bold tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {profit.toFixed(2)} €
          </div>
        </div>
      </div>
    </div>
  );
}
