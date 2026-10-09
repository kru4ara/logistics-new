export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Приветствие */}
        <div className="space-y-2">
          <div className="skeleton h-8 md:h-9 w-56 md:w-64" />
          <div className="skeleton h-4 w-64 md:w-80" />
        </div>

        {/* Показатели за месяц */}
        <div>
          <div className="skeleton h-3 w-44 mb-3" />
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 md:p-5">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="skeleton h-3.5 w-16" />
                  <div className="skeleton w-8 h-8 md:w-9 md:h-9 rounded-xl" />
                </div>
                <div className="skeleton h-7 md:h-8 w-24 mb-2" />
                <div className="skeleton h-3 w-32" />
              </div>
            ))}
          </div>
        </div>

        {/* «За всё время» */}
        <div>
          <div className="skeleton h-3 w-28 mb-3" />
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse p-4 md:p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-3.5 w-20 rounded bg-slate-300" />
                  <div className="h-4 w-4 md:h-5 md:w-5 rounded bg-slate-300" />
                </div>
                <div className="h-7 md:h-8 w-24 rounded bg-slate-300 mb-2" />
                <div className="h-3 w-28 rounded bg-slate-300" />
              </div>
            ))}
          </div>
        </div>

        {/* График 12 месяцев */}
        <div className="card p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="skeleton h-5 w-52" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-end justify-between gap-1.5 md:gap-2 h-48 md:h-64">
            {[45, 60, 35, 75, 50, 80, 55, 70, 40, 65, 50, 85].map((h, i) => (
              <div
                key={i}
                className="skeleton flex-1 rounded-t-md"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Донат расходов */}
        <div className="card p-5 md:p-6">
          <div className="skeleton h-5 w-44 mb-4" />
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="skeleton w-40 h-40 md:w-48 md:h-48 rounded-full shrink-0" />
            <div className="flex-1 w-full space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-3 h-3 rounded-full shrink-0" />
                  <div className="skeleton h-3.5 flex-1 max-w-[160px]" />
                  <div className="skeleton h-3.5 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
