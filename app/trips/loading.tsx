export default function TripsLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
        
        {/* Заголовок */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-slate-200 rounded-xl animate-pulse" />
        </div>

        {/* Фильтры */}
        <div className="card p-4 md:p-5 space-y-4">
          <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>

        {/* Сетка карточек */}
        <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 space-y-4 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-1/2 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-200 rounded" />
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                <div className="h-10 bg-slate-200 rounded" />
                <div className="h-10 bg-slate-200 rounded" />
                <div className="h-10 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
