export default function TrucksLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Заголовок + кнопка */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-2">
            <div className="skeleton h-8 md:h-9 w-52" />
            <div className="skeleton h-4 w-56" />
          </div>
          <div className="skeleton h-11 w-full sm:w-52" />
        </div>

        {/* Тягачи */}
        <div>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-4 w-8" />
          </div>
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="p-4 md:p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="skeleton w-14 h-14 rounded-xl shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-5 w-3/4" />
                      <div className="skeleton h-3.5 w-1/2" />
                    </div>
                    <div className="skeleton w-4 h-4 rounded shrink-0" />
                  </div>
                  <div className="skeleton h-9 w-full rounded-xl" />
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="space-y-1.5">
                        <div className="skeleton h-2.5 w-14" />
                        <div className="skeleton h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Прицепы */}
        <div>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-4 w-8" />
          </div>
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="p-4 md:p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="skeleton w-14 h-14 rounded-xl shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-5 w-3/4" />
                      <div className="skeleton h-3.5 w-1/2" />
                    </div>
                    <div className="skeleton w-4 h-4 rounded shrink-0" />
                  </div>
                  <div className="skeleton h-9 w-full rounded-xl" />
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="space-y-1.5">
                        <div className="skeleton h-2.5 w-14" />
                        <div className="skeleton h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
