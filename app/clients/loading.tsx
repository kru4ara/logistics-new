export default function ClientsLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок + кнопка */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-2">
            <div className="skeleton h-8 md:h-9 w-40" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="skeleton h-11 w-full sm:w-48" />
        </div>

        {/* Сетка карточек клиентов */}
        <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden flex flex-col">
              <div className="p-5 flex-1 space-y-4">
                {/* Аватар + имя */}
                <div className="flex items-center gap-4">
                  <div className="skeleton w-14 h-14 rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-3.5 w-1/2" />
                  </div>
                </div>

                {/* Контакты */}
                <div className="space-y-1.5">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3.5 w-2/3" />
                </div>

                {/* Футер */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="skeleton h-3.5 w-24" />
                  <div className="skeleton w-4 h-4 rounded" />
                </div>
              </div>

              {/* Кнопки */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
                <div className="skeleton h-9 flex-1 rounded-lg" />
                <div className="skeleton h-9 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
