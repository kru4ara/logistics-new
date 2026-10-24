import { BarChart3 } from 'lucide-react';

export default function StatisticsHeader({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
          <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
          Статистика
        </h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
          Рейсы + Экспедирование за {year} год
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <a
            key={y}
            href={`/statistics?year=${y}`}
            className={`px-3 md:px-4 py-2 rounded-xl font-semibold text-sm transition-all tabular-nums
              ${y === year
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-brand-50 hover:border-brand-300'
              }`}
          >
            {y}
          </a>
        ))}
      </div>
    </div>
  );
}
