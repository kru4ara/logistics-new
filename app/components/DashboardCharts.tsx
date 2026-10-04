type MonthPoint = {
  key: string;
  label: string;
  profit: number;
};

type CategorySlice = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  amount: number;
};

export function MonthlyBars({ data }: { data: MonthPoint[] }) {
  if (data.length === 0) return null;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.profit)), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">
            📈 Прибыль по месяцам
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            За последние 12 месяцев
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500" />
            Прибыль
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-500" />
            Убыток
          </span>
        </div>
      </div>

      <div className="relative h-40 md:h-56">
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-200" />
        <div className="absolute inset-0 flex items-stretch gap-0.5 md:gap-1">
          {data.map((m) => {
            const pct = (Math.abs(m.profit) / maxAbs) * 50;
            const isPos = m.profit >= 0;
            return (
              <div key={m.key} className="flex-1 relative">
                {isPos ? (
                  <div
                    className="absolute left-[1px] right-[1px] bottom-1/2 rounded-t bg-emerald-500 hover:bg-emerald-600 transition-colors"
                    style={{ height: `${Math.max(pct, 1)}%` }}
                    title={`${m.label}: ${m.profit.toFixed(0)} €`}
                  />
                ) : (
                  <div
                    className="absolute left-[1px] right-[1px] top-1/2 rounded-b bg-red-500 hover:bg-red-600 transition-colors"
                    style={{ height: `${Math.max(pct, 1)}%` }}
                    title={`${m.label}: ${m.profit.toFixed(0)} €`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-stretch gap-0.5 md:gap-1 mt-2">
        {data.map((m) => (
          <div
            key={`lbl-${m.key}`}
            className="flex-1 text-center text-[10px] md:text-xs text-slate-500 font-medium"
          >
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpenseDonut({
  data,
  total,
}: {
  data: CategorySlice[];
  total: number;
}) {
  if (data.length === 0 || total <= 0) return null;

  const R = 40;
  const CX = 50;
  const CY = 50;
  const C = 2 * Math.PI * R;

  let cursor = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
      <h2 className="text-base md:text-lg font-bold text-slate-900 mb-4">
        💸 Расходы по категориям
      </h2>

      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="relative mx-auto md:mx-0 w-40 h-40 md:w-48 md:h-48 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="20"
            />
            {data.map((s) => {
              const frac = s.amount / total;
              const len = frac * C;
              const dash = `${len} ${C - len}`;
              const offset = -cursor;
              cursor += len;
              return (
                <circle
                  key={s.key}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wide">
              Всего
            </div>
            <div className="text-base md:text-xl font-bold text-slate-800">
              {total.toFixed(0)} €
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          {data.map((s) => {
            const pct = (s.amount / total) * 100;
            return (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block w-3 h-3 rounded shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="shrink-0">{s.emoji}</span>
                <span className="flex-1 text-slate-700 truncate min-w-0">
                  {s.label}
                </span>
                <span className="font-semibold text-slate-800 whitespace-nowrap">
                  {s.amount.toFixed(0)} €
                </span>
                <span className="text-xs text-slate-400 w-12 text-right whitespace-nowrap">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
