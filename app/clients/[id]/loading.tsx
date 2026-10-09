export default function ClientDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Ссылка «Все клиенты» */}
        <div className="skeleton h-5 w-32" />

        {/* ШАПКА */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-5 min-w-0 flex-1">
              <div className="skeleton w-20 h-20 rounded-2xl shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-7 w-56 max-w-full" />
                <div className="flex flex-wrap gap-4">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-4 w-40" />
                </div>
              </div>
            </div>
            <div className="skeleton h-11 w-40 rounded-xl shrink-0" />
          </div>
        </div>

        {/* ФИНАНСЫ — 3 карточки */}
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 md:p-6 space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-7 md:h-8 w-40" />
            </div>
          ))}
        </div>

        {/* СПИСОК РЕЙСОВ */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-48" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border border-slate-100 rounded-xl p-4 space-y-3"
              >
                {/* Заголовок рейса */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-2/3" />
                      <div className="skeleton h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="skeleton h-6 w-20 rounded-full" />
                    <div className="skeleton h-4 w-16" />
                  </div>
                </div>

                {/* Метрики рейса */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
