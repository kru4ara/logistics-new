export default function TripDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Ссылка «Все рейсы» */}
        <div className="skeleton h-5 w-32" />

        {/* ЗАГОЛОВОК */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-8 md:h-9 w-32" />
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-4 w-56" />
            </div>
            <div className="skeleton h-6 w-24 rounded-full shrink-0" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-10 w-32 rounded-xl flex-1 sm:flex-none" />
            <div className="skeleton h-10 w-28 rounded-lg" />
            <div className="skeleton h-10 w-28 rounded-xl flex-1 sm:flex-none" />
          </div>
        </div>

        {/* ИНФОРМАЦИЯ */}
        <div className="card p-5 md:p-6 space-y-4">
          {/* Верхняя сетка: маршрут / тягач-прицеп / водитель / телефон */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`space-y-1.5 ${i === 0 ? 'col-span-2' : ''}`}>
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>

          {/* Цифры: фрахт / топливо / старт / финиш */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 pt-4 border-t border-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-6 md:h-7 w-24" />
              </div>
            ))}
          </div>

          {/* Одометры */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 pt-4 border-t border-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-6 md:h-7 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* ТОЧКИ МАРШРУТА */}
        <div className="card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-44" />
          </div>

          {/* Загрузка */}
          <div className="mb-6 space-y-3">
            <div className="skeleton h-4 w-28" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border-l-4 border-l-slate-200 pl-4 py-1 space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="skeleton h-5 w-8 rounded" />
                  <div className="skeleton h-4 w-40" />
                </div>
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-28" />
              </div>
            ))}
          </div>

          {/* Выгрузка */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="skeleton h-4 w-24" />
            <div className="border-l-4 border-l-slate-200 pl-4 py-1 space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          </div>
        </div>

        {/* ЗАДАНИЕ ДЛЯ ВОДИТЕЛЯ */}
        <div className="space-y-3">
          <div className="card p-5 md:p-6 space-y-3">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
          <div className="card p-5 md:p-6">
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
        </div>

        {/* КНОПКИ СТАТУСА */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="skeleton h-4 w-40" />
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-11 w-full md:w-36 rounded-xl" />
            ))}
          </div>
        </div>

        {/* ПОДРЯДЧИКИ НА РЕЙСЕ */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="skeleton w-5 h-5 rounded" />
              <div className="skeleton h-6 w-48" />
            </div>
            <div className="skeleton h-9 w-28 rounded-lg" />
          </div>
          <div className="skeleton h-3 w-full" />
          <div className="space-y-3">
            {Array.from({ length: 1 }).map((_, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="skeleton h-5 w-40" />
                    <div className="skeleton h-3.5 w-24" />
                  </div>
                  <div className="skeleton h-6 w-24" />
                </div>
                <div className="skeleton h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* ТЕЛЕМЕТРИЯ */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-48" />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px] space-y-1.5">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
            <div className="flex-1 min-w-[120px] space-y-1.5">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
            <div className="skeleton h-11 w-full sm:w-28 rounded-xl" />
          </div>
        </div>

        {/* ЗАГРУЗКА ДОКУМЕНТОВ */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-56" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="skeleton h-12 w-full rounded-xl md:hidden" />
            <div className="skeleton h-11 w-full rounded-xl" />
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>

        {/* ЗАГРУЖЕННЫЕ ФАЙЛЫ */}
        <div className="card p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-52" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
              <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
            </div>
          ))}
        </div>

        {/* РАСХОДЫ */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="skeleton w-5 h-5 rounded" />
              <div className="skeleton h-6 w-44" />
            </div>
            <div className="skeleton h-4 w-24" />
          </div>

          {/* Desktop-таблица */}
          <div className="hidden md:block space-y-3">
            <div className="grid grid-cols-6 gap-3 pb-3 border-b border-slate-100">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 w-16 ml-auto" />
              <div className="skeleton h-3 w-12 ml-auto" />
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-14 ml-auto" />
              <div className="skeleton h-3 w-10 ml-auto" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-3 py-3 border-b border-slate-50">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-16 ml-auto" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-14 ml-auto" />
              </div>
            ))}
          </div>

          {/* Mobile-карточки */}
          <div className="md:hidden space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="skeleton h-3 w-12" />
                    <div className="skeleton h-4 w-20" />
                  </div>
                  <div className="space-y-1">
                    <div className="skeleton h-3 w-12" />
                    <div className="skeleton h-4 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ЭКОНОМИКА */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-44" />
          </div>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 border border-slate-100 bg-slate-50/40 space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-7 w-28" />
              </div>
            ))}
          </div>
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
                <div className="skeleton h-11 w-full rounded-xl" />
              </div>
            ))}
            <div className="md:col-span-2 space-y-1.5">
              <div className="skeleton h-3.5 w-20" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <div className="skeleton h-3.5 w-16" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
          </div>
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

      </div>
    </main>
  );
}
