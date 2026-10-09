export default function ReportsLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок + кнопка */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-2">
            <div className="skeleton h-8 md:h-9 w-56" />
            <div className="skeleton h-4 w-72" />
          </div>
          <div className="skeleton h-10 w-40" />
        </div>

        {/* 3 градиентные карточки-ссылки */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-slate-200 animate-pulse p-5 md:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-300 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 md:h-6 w-32 rounded bg-slate-300" />
                  <div className="h-3.5 w-full max-w-[240px] rounded bg-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="skeleton h-3.5 w-24" />
                <div className="skeleton w-8 h-8 md:w-10 md:h-10 rounded-xl" />
              </div>
              <div className="skeleton h-7 md:h-9 w-32" />
            </div>
          ))}
        </div>

        {/* Таблица */}
        <div className="card overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100">
            <div className="skeleton h-6 w-52" />
          </div>

          {/* Шапка таблицы */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-3 px-6 py-3 bg-slate-50/50 border-b border-slate-100">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`skeleton h-3 ${i >= 4 ? 'ml-auto w-16' : 'w-20'}`}
                />
              ))}
            </div>

            {/* Строки */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-7 gap-3 px-6 py-4 border-b border-slate-50"
              >
                <div className="skeleton h-4 w-8" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-5 w-24 rounded-full" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>

          {/* Мобильные карточки */}
          <div className="md:hidden divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-4 w-3/4" />
                  </div>
                  <div className="skeleton h-5 w-20 rounded-full shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="space-y-1.5">
                      <div className="skeleton h-3 w-12" />
                      <div className="skeleton h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
