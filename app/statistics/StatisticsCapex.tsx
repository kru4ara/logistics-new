import { Briefcase, Calendar } from 'lucide-react';
import type { CapexItem } from '../../lib/statistics';

export default function StatisticsCapex({
  year,
  capexForYear,
  capexTotalForYear,
}: {
  year: number;
  capexForYear: CapexItem[];
  capexTotalForYear: number;
}) {
  if (capexForYear.length === 0) return null;

  return (
    <div className="card border-amber-200 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
          Инвестиции за {year}
        </h2>
        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
          вне P&L
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Покупки активов: машины, прицепы, крупное оборудование.
        Эти суммы <b>не вычитаются</b> из операционной прибыли.
      </p>
      <div className="space-y-2">
        {capexForYear.map((c) => (
          <div
            key={c.id}
            className="flex items-start justify-between gap-3 border border-slate-100 rounded-xl p-3 md:p-4 bg-amber-50/30"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800 text-sm break-words">
                {c.category}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
                <Calendar className="w-3 h-3" strokeWidth={2} />
                {new Date(c.date).toLocaleDateString('ru-RU')}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-base font-bold text-amber-600 whitespace-nowrap tabular-nums">
                {c.amount_eur.toFixed(0)} €
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-amber-200 flex justify-between items-baseline gap-2 flex-wrap">
        <span className="text-sm text-slate-500">
          Всего операций: <b className="text-slate-700 tabular-nums">{capexForYear.length}</b>
        </span>
        <span className="text-sm text-slate-500">
          Итого инвестиций: <b className="text-amber-600 text-base tabular-nums">{capexTotalForYear.toFixed(0)} €</b>
        </span>
      </div>
    </div>
  );
}
