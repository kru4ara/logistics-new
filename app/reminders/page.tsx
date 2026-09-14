import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const reminderStats = reminders?.map((r) => ({
    ...r,
    daysLeft: getDaysUntil(r.due_date),
  })) || [];

  const expiredCount = reminderStats.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
  const soonCount = reminderStats.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft < 30).length;
  const okCount = reminderStats.filter((r) => r.daysLeft !== null && r.daysLeft >= 30).length;

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    insurance: { label: 'Страховка', icon: '🛡' },
    inspection: { label: 'Техосмотр', icon: '🔧' },
    driver_doc: { label: 'Документы водителя', icon: '📄' },
    payment_to_contractor: { label: 'Подрядчик', icon: '🚛' },
    accounting: { label: 'Бухгалтерия', icon: '💰' },
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">⏰ Напоминания</h1>
            <p className="text-slate-500 mt-1">Всего записей: {reminders?.length || 0}</p>
          </div>
          <a
            href="/reminders/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить напоминание</span>
          </a>
        </div>

        {/* Карточки-счётчики */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Сроки истекли</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">⚠️</div>
            </div>
            <div className="text-3xl font-bold text-red-600">{expiredCount}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Скоро (до 30 дней)</span>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl">⚡</div>
            </div>
            <div className="text-3xl font-bold text-orange-500">{soonCount}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">В порядке</span>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">✅</div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{okCount}</div>
          </div>
        </div>

        {/* Список напоминаний */}
        {reminders?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Напоминаний пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте напоминание, чтобы не пропустить срок</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reminderStats.map((r) => {
              const cat = categoryLabels[r.category] || { label: r.category, icon: '📌' };
              const daysLeft = r.daysLeft;

              const statusBorder =
                daysLeft !== null && daysLeft < 0 ? 'border-l-red-500' :
                daysLeft !== null && daysLeft < 30 ? 'border-l-orange-500' :
                'border-l-green-500';

              const statusBadge =
                daysLeft !== null && daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' :
                daysLeft !== null && daysLeft < 30 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-green-50 text-green-700 border-green-200';

              const statusText =
                daysLeft !== null && daysLeft < 0 ? `⚠️ Просрочено (${Math.abs(daysLeft)} дн.)` :
                daysLeft !== null && daysLeft < 30 ? `⚡ ${daysLeft} дн.` :
                daysLeft !== null ? `✅ ${daysLeft} дн.` : '—';

              return (
                <div
                  key={r.id}
                  className={`bg-white rounded-2xl border border-slate-100 border-l-4 shadow-sm
                              p-5 hover:shadow-md transition-all ${statusBorder}`}
                >
                  {/* Категория */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                      {cat.label}
                    </span>
                  </div>

                  {/* Заголовок */}
                  <h3 className="text-lg font-bold text-slate-900 mb-3 truncate">
                    {r.title}
                  </h3>

                  {/* Дата */}
                  <div className="text-sm text-slate-500 mb-4">
                    📅 {r.due_date ? new Date(r.due_date).toLocaleDateString('ru-RU') : '—'}
                  </div>

                  {/* Статус */}
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge}`}>
                    {statusText}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
