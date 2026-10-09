export default function ForwardingLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок + кнопка */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-2">
            <div className="skeleton h-8 md:h-9 w-56" />
            <div className="skeleton h-4 w-40" />
          </div>
          <div className="skeleton h-11 w-full sm:w-44" />
        </div>

        {/* Фильтр-карточка */}
        <div className="card p-4 md:p-5 space-y-3">
          <div className="space-y-2">
            <div className="skeleton h-3 w-12" />
            <div className="flex flex-wrap gap-2">
              {[24, 24, 24].map((w, i) => (
                <div key={i} className="skeleton h-10 rounded-lg" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="skeleton h-8 w-12 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Итоги */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-6 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Заголовок месяца */}
        <div className="flex items-center gap-3 px-1">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>

        {/* Сетка карточек заявок */}
        <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="h-1.5 bg-slate-200" />
              <div className="p-4 md:p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-3 w-14" />
                    <div className="skeleton h-5 w-3/4" />
                  </div>
                  <div className="skeleton h-6 w-20 rounded-full shrink-0" />
                </div>
                <div className="skeleton h-3.5 w-2/3" />
                <div className="skeleton h-4 w-full" />
                <div className="flex gap-3">
                  <div className="skeleton h-3.5 w-24" />
                  <div className="skeleton h-3.5 w-24" />
                </div>
                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-12" />
                    <div className="skeleton h-5 w-16" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton h-5 w-16" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-14" />
                    <div className="skeleton h-5 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
