import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import ReminderCard, { ReminderCardData } from './ReminderCard';

export const dynamic = 'force-dynamic';

type SearchParams = { show?: string };

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const show = searchParams.show || 'active';

  // Загружаем всё — фильтр делаем на клиенте, чтобы считать статистику по всем
  const { data: allReminders, error } = await supabase
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

  const enriched: ReminderCardData[] = (allReminders || []).map((r) => ({
    id: r.id,
    title: r.title || '',
    category: r.category || '',
    due_date: r.due_date,
    amount: r.amount,
    status: r.status || 'active',
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    daysLeft: getDaysUntil(r.due_date),
  }));

  // Счётчики
  const activeReminders = enriched.filter((r) => r.status !== 'done');
  const doneReminders = enriched.filter((r) => r.status === 'done');

  const expiredCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
  const soonCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft < 30).length;
  const okCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft >= 30).length;

  // Фильтрация для отображения
  const visible =
    show === 'done' ? doneReminders :
    show === 'all' ? enriched :
    activeReminders;

  // Сортируем активные — просроченные вперёд
  if (show === 'active') {
    visible.sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">⏰ Напоминания</h1>
            <p className="text-slate-500 mt-1">
              Активных: <b>{activeReminders.length}</b> · Выполненных: <b>{doneReminders.length}</b>
            </p>
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

        {/* Счётчики активных */}
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

        {/* Фильтр */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-wrap gap-2">
          <a
            href="/reminders?show=active"
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'active'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            🟢 Активные ({activeReminders.length})
          </a>
          <a
            href="/reminders?show=done"
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'done'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            ✅ Выполненные ({doneReminders.length})
          </a>
          <a
            href="/reminders?show=all"
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            📋 Все ({enriched.length})
          </a>
        </div>

        {/* Список */}
        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {show === 'done' ? 'Нет выполненных' :
               show === 'all' ? 'Напоминаний пока нет' :
               'Все активные напоминания отработаны'}
            </h2>
            <p className="text-slate-500 mb-6">
              {show === 'active'
                ? 'Добавьте новое напоминание, чтобы не пропустить важный срок'
                : 'Переключитесь на другую вкладку'}
            </p>
            {show === 'active' && (
              <a
                href="/reminders/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl"
              >
                ➕ Добавить напоминание
              </a>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <ReminderCard key={r.id} r={r} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
