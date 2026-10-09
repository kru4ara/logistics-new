export default function ForwardingDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Ссылка «Все заявки» */}
        <div className="skeleton h-5 w-32" />

        {/* ЗАГОЛОВОК */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-8 md:h-9 w-52" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-56" />
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 sm:shrink-0">
              <div className="skeleton h-10 w-32 rounded-lg flex-1 sm:flex-none" />
              <div className="skeleton h-10 w-24 rounded-lg flex-1 sm:flex-none" />
            </div>
          </div>
        </div>

        {/* СТАТУС */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-7 w-28 rounded-full" />
          </div>
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-9 w-28 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* ЭКОНОМИКА */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-32" />
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-7 md:h-8 w-32" />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-6 w-24" />
          </div>

          <div className="pt-3 border-t-2 border-slate-200 space-y-2">
            <div className="flex justify-between items-baseline gap-3">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-8 md:h-9 w-32" />
            </div>
            <div className="flex justify-end">
              <div className="skeleton h-3 w-36" />
            </div>
          </div>
        </div>

        {/* КЛИЕНТ */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-24" />
          </div>
          <div className="border-l-4 border-l-slate-200 pl-4 py-1 space-y-2">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-36" />
          </div>
        </div>

        {/* ТОЧКИ МАРШРУТА */}
        <div className="card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-44" />
          </div>

          {/* Погрузка */}
          <div className="mb-6 space-y-3">
            <div className="skeleton h-4 w-28" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border-l-4 border-l-slate-200 pl-4 py-2 space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="skeleton h-5 w-8 rounded" />
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-32" />
              </div>
            ))}
          </div>

          {/* Выгрузка */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="skeleton h-4 w-24" />
            {Array.from({ length: 1 }).map((_, i) => (
              <div key={i} className="border-l-4 border-l-slate-200 pl-4 py-2 space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="skeleton h-5 w-8 rounded" />
                  <div className="skeleton h-4 w-40" />
                </div>
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>

        {/* ПОДРЯДЧИКИ */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-36" />
            <div className="skeleton h-5 w-8 rounded-full" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-l-4 border-l-slate-200 pl-4 py-2 space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="skeleton h-5 w-8 rounded" />
                <div className="skeleton h-4 w-40" />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-28" />
              </div>
              <div className="flex gap-3">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-7 w-28 rounded-lg" />
            </div>
          ))}
        </div>

        {/* РАСХОДЫ */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-36" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-24 flex-1" />
                <div className="skeleton h-5 w-20" />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-3 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* ДОБАВИТЬ РАСХОД */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-40" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3.5 w-20" />
                <div className="skeleton h-11 w-full rounded-lg" />
              </div>
            ))}
            <div className="md:col-span-2 space-y-1.5">
              <div className="skeleton h-3.5 w-20" />
              <div className="skeleton h-11 w-full rounded-lg" />
            </div>
          </div>
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>

      </div>
    </main>
  );
}
