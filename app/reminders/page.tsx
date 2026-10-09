import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import ReminderCard, { ReminderCardData } from './ReminderCard';
import {
  Bell,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  List as ListIcon,
  Check,
  Inbox,
} from 'lucide-react';

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

  const activeReminders = enriched.filter((r) => r.status !== 'done');
  const doneReminders = enriched.filter((r) => r.status === 'done');

  const expiredCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
  const soonCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft < 30).length;
  const okCount = activeReminders.filter((r) => r.daysLeft !== null && r.daysLeft >= 30).length;

  const visible =
    show === 'done' ? doneReminders :
    show === 'all' ? enriched :
    activeReminders;

  if (show === 'active') {
    visible.sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Bell className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Напоминания
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Активных: <b className="text-slate-700">{activeReminders.length}</b> · Выполненных: <b className="text-slate-700">{doneReminders.length}</b>
            </p>
          </div>
          <a href="/reminders/new" className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить напоминание
          </a>
        </div>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">Сроки истекли</span>
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-600 tabular-nums">{expiredCount}</div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">Скоро (до 30 дней)</span>
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-orange-500 tabular-nums">{soonCount}</div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">В порядке</span>
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 tabular-nums">{okCount}</div>
          </div>
        </div>

        {/* Фильтр */}
        <div className="card p-3 flex flex-wrap gap-2">
          <a
            href="/reminders?show=active"
            className={`inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'active'
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Clock className="w-4 h-4" strokeWidth={2.2} />
            Активные ({activeReminders.length})
          </a>
          <a
            href="/reminders?show=done"
            className={`inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'done'
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Check className="w-4 h-4" strokeWidth={2.2} />
            Выполненные ({doneReminders.length})
          </a>
          <a
            href="/reminders?show=all"
            className={`inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${show === 'all'
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <ListIcon className="w-4 h-4" strokeWidth={2.2} />
            Все ({enriched.length})
          </a>
        </div>

        {/* Список */}
        {visible.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
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
              <a href="/reminders/new" className="btn btn-primary inline-flex">
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Добавить напоминание
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
