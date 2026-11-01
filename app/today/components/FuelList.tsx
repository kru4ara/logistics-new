import { Fuel } from 'lucide-react';
import { formatLiters } from '../../../lib/fuel';

export type FuelRow = {
  id: string;
  registration: string;
  liters: number | null;
  isEstimate: boolean;
  tripNumber: string | null;
  date: string | null;
};

/** Список тягачей с остатком топлива в баке. */
export default function FuelList({ rows }: { rows: FuelRow[] }) {
  return (
    <div className="card divide-y divide-slate-100 overflow-hidden">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Fuel className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
            <span className="font-semibold text-slate-800 tabular-nums truncate">
              {r.registration}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-slate-900 tabular-nums">
              {r.liters != null
                ? (r.isEstimate ? '~' : '') + formatLiters(r.liters) + ' л'
                : '—'}
            </div>
            {r.tripNumber && (
              <div className="text-[11px] text-slate-400 tabular-nums">
                рейс №{r.tripNumber}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
