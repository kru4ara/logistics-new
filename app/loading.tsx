// Общая заставка загрузки для страниц без своей: заголовок и пара нейтральных
// блоков — без графиков и плиток конкретной страницы (раньше здесь был скелет
// главной, и, например, «Общие расходы» при загрузке выглядели как статистика).
export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50" aria-busy="true">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div className="space-y-2">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-4 w-72 max-w-full" />
        </div>
        <div className="card p-5 space-y-3">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
        <div className="card p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    </main>
  );
}
