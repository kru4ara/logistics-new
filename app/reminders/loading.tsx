export default function RemindersLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок + кнопка */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-2">
            <div className="skeleton h-8 md:h-9 w-52" />
            <div className="skeleton h-4 w-64" />
          </div>
          <div className="skeleton h-11 w-full sm:w-56" />
        </div>

        {/* KPI — 3 карточки */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="skeleton h-3.5 w-32" />
                <div className="skeleton w-9 h-9 rounded-xl" />
              </div>
              <div className="skeleton h-8 md:h-9 w-16 mt-2" />
            </div>
          ))}
        </div>

        {/* Фильтр */}
        <div className="card p-3 flex flex-wrap gap-2">
          <div className="skeleton h-9 w-32 rounded-lg" />
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-lg" />
        </div>

        {/* Сетка карточек напоминаний */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card border-l-4 border-l-slate-200 p-5">
              {/* Категория */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="skeleton w-4 h-4 rounded shrink-0" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-4 w-14 rounded-full" />
              </div>

              {/* Заголовок */}
              <div className="skeleton h-5 w-3/4 mb-3" />

              {/* Дата + сумма */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
              </div>

              {/* Статус-бейдж */}
              <div className="skeleton h-6 w-28 rounded-full mb-4" />

              {/* Кнопки */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                <div className="skeleton h-7 w-24 rounded-lg" />
                <div className="skeleton h-7 w-24 rounded-lg" />
                <div className="skeleton h-7 w-28 rounded-lg" />
                <div className="skeleton h-7 w-20 rounded-lg ml-auto" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
