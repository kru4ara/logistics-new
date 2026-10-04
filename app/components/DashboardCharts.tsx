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

// ============================================================
// Красивое округление максимума вверх
// ============================================================
function niceMax(n: number): number {
  if (n <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const mantissa = n / pow;
  if (mantissa <= 1) return pow;
  if (mantissa <= 2) return 2 * pow;
  if (mantissa <= 5) return 5 * pow;
  return 10 * pow;
}

function formatTick(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace('.0', '') + 'М';
  if (abs >= 1000) return sign + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.0', '') + 'к';
  return sign + String(abs);
}

// ============================================================
// BAR CHART — компактный, с осями и сеткой
// ============================================================
export function MonthlyBars({ data }: { data: MonthPoint[] }) {
  if (data.length === 0) return null;

  const W = 800;
  const H = 200;
  const PAD_L = 56;
  const PAD_R = 12;
  const PAD_T = 24;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = data.map((d) => d.profit);
  const maxPosRaw = Math.max(0, ...values);
  const maxNegRaw = Math.max(0, ...values.map((v) => -v));
  const maxPos = niceMax(maxPosRaw);
  const maxNeg = niceMax(maxNegRaw);
  const range = maxPos + maxNeg || 1;

  const zeroY = PAD_T + (maxPos / range) * chartH;

  const slotW = chartW / data.length;
  const barW = Math.min(slotW * 0.5, 36);

  const yTicks: number[] = [];
  if (maxPos > 0) {
    yTicks.push(maxPos);
    yTicks.push(maxPos / 2);
  }
  yTicks.push(0);
  if (maxNeg > 0) {
    yTicks.push(-maxNeg / 2);
    yTicks.push(-maxNeg);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">
            📈 Прибыль по месяцам
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Последние 12 месяцев
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
            Прибыль
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
            Убыток
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {yTicks.map((tick) => {
          const y = PAD_T + ((maxPos - tick) / range) * chartH;
          const isZero = tick === 0;
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke={isZero ? '#94a3b8' : '#e2e8f0'}
                strokeWidth={isZero ? 1.2 : 1}
                strokeDasharray={isZero ? '0' : '3 3'}
              />
              <text
                x={PAD_L - 8}
                y={y + 4}
                textAnchor="end"
                style={{ fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}
                fill="#64748b"
              >
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        {data.map((m, i) => {
          const cx = PAD_L + slotW * i + slotW / 2;
          const val = m.profit;
          const isPos = val >= 0;
          const absH = (Math.abs(val) / range) * chartH;
          const x = cx - barW / 2;
          const y = isPos ? zeroY - absH : zeroY;
          const fill = isPos ? '#10b981' : '#ef4444';

          const showLabel = Math.abs(val) > range * 0.08;

          return (
            <g key={m.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(absH, 1.5)}
                rx={4}
                ry={4}
                fill={fill}
                opacity={val === 0 ? 0.35 : 1}
              >
                <title>
                  {m.label}: {val >= 0 ? '+' : ''}
                  {val.toFixed(0)} €
                </title>
              </rect>

              {showLabel && (
                <text
                  x={cx}
                  y={isPos ? y - 4 : y + absH + 12}
                  textAnchor="middle"
                  style={{ fontSize: '10px', fontFamily: 'system-ui, sans-serif' }}
                  fill={isPos ? '#059669' : '#dc2626'}
                  fontWeight="600"
                >
                  {formatTick(val)}
                </text>
              )}

              <text
                x={cx}
                y={H - PAD_B + 18}
                textAnchor="middle"
                style={{ fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}
                fill="#64748b"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// DONUT — все категории, палитра из 16 контрастных цветов
// ============================================================
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

  // Разделяем легенду на 2 колонки, если категорий больше 8
  const useTwoCols = data.length > 8;
  const half = Math.ceil(data.length / 2);
  const left = useTwoCols ? data.slice(0, half) : data;
  const right = useTwoCols ? data.slice(half) : [];

  const renderLegendItem = (s: CategorySlice) => {
    const pct = (s.amount / total) * 100;
    return (
      <div key={s.key}>
        <div className="flex items-center gap-2 text-sm mb-1">
          <span
            className="inline-block w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="shrink-0">{s.emoji}</span>
          <span className="flex-1 text-slate-700 truncate min-w-0">
            {s.label}
          </span>
          <span className="font-semibold text-slate-800 whitespace-nowrap tabular-nums">
            {s.amount.toFixed(0)} €
          </span>
          <span className="text-xs text-slate-400 w-12 text-right whitespace-nowrap tabular-nums">
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: s.color,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">
            💸 Структура расходов
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Все категории по рейсам за всё время
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
        <div className="relative mx-auto w-48 h-48 md:sticky md:top-4">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="22"
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
                  strokeWidth="22"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
              Всего
            </div>
            <div className="text-lg md:text-xl font-bold text-slate-800">
              {total.toFixed(0)} €
            </div>
          </div>
        </div>

        {useTwoCols ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
            <div className="space-y-3">{left.map(renderLegendItem)}</div>
            <div className="space-y-3">{right.map(renderLegendItem)}</div>
          </div>
        ) : (
          <div className="space-y-3">{data.map(renderLegendItem)}</div>
        )}
      </div>
    </div>
  );
}
