'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteReminder, markReminderDone, reopenReminder } from './actions';
import { sendReminderNotification } from './telegram-actions';

export type ReminderCardData = {
  id: string;
  title: string;
  category: string;
  due_date: string | null;
  amount: number | null;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  daysLeft: number | null;
};

const categoryLabels: Record<string, { label: string; icon: string }> = {
  insurance: { label: 'Страховка', icon: '🛡' },
  inspection: { label: 'Техосмотр', icon: '🔧' },
  driver_doc: { label: 'Документы водителя', icon: '📄' },
  payment_to_contractor: { label: 'Подрядчик', icon: '🚛' },
  accounting: { label: 'Бухгалтерия', icon: '💰' },
};

export default function ReminderCard({ r }: { r: ReminderCardData }) {
  const [isPending, startTransition] = useTransition();
  const [tgMessage, setTgMessage] = useState<string | null>(null);

  const cat = categoryLabels[r.category] || { label: r.category, icon: '📌' };
  const isAuto = r.entity_type !== null && r.entity_id !== null;
  const isDone = r.status === 'done';
  const daysLeft = r.daysLeft;

  const statusBorder =
    isDone ? 'border-l-slate-300' :
    daysLeft !== null && daysLeft < 0 ? 'border-l-red-500' :
    daysLeft !== null && daysLeft < 30 ? 'border-l-orange-500' :
    'border-l-green-500';

  const statusBadge =
    isDone ? 'bg-slate-100 text-slate-500 border-slate-200' :
    daysLeft !== null && daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' :
    daysLeft !== null && daysLeft < 30 ? 'bg-orange-50 text-orange-700 border-orange-200' :
    'bg-green-50 text-green-700 border-green-200';

  const statusText =
    isDone ? '✅ Выполнено' :
    daysLeft !== null && daysLeft < 0 ? `⚠️ Просрочено (${Math.abs(daysLeft)} дн.)` :
    daysLeft !== null && daysLeft < 30 ? `⚡ ${daysLeft} дн.` :
    daysLeft !== null ? `✅ ${daysLeft} дн.` : '—';

  function handleDelete() {
    if (!confirm(`Удалить напоминание "${r.title}"?`)) return;
    startTransition(async () => {
      await deleteReminder(r.id);
    });
  }

  function handleToggleDone() {
    startTransition(async () => {
      if (isDone) await reopenReminder(r.id);
      else await markReminderDone(r.id);
    });
  }

  function handleSendTg() {
    startTransition(async () => {
      const res = await sendReminderNotification(r.id);
      setTgMessage(res.message);
      setTimeout(() => setTgMessage(null), 4000);
    });
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 border-l-4 shadow-sm
                  p-5 hover:shadow-md transition-all ${statusBorder}
                  ${isPending ? 'opacity-60' : ''}
                  ${isDone ? 'bg-slate-50/60' : ''}`}
    >
      {/* Категория + бейдж авто */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{cat.icon}</span>
          <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold truncate">
            {cat.label}
          </span>
        </div>
        {isAuto && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold whitespace-nowrap"
            title="Привязано к документу — обновляется автоматически"
          >
            🔒 Авто
          </span>
        )}
      </div>

      {/* Заголовок */}
      <h3 className={`text-lg font-bold mb-2 truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
        {r.title}
      </h3>

      {/* Дата */}
      <div className="text-sm text-slate-500 mb-4">
        📅 {r.due_date ? new Date(r.due_date).toLocaleDateString('ru-RU') : '—'}
        {r.amount ? (
          <span className="ml-3 text-slate-600">
            💰 <b>{r.amount}</b> €
          </span>
        ) : null}
      </div>

      {/* Статус */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge}`}>
          {statusText}
        </span>
      </div>

      {/* Кнопки */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
        {/* Выполнено / Вернуть — только для ручных */}
        {!isAuto && (
          <button
            type="button"
            onClick={handleToggleDone}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isDone
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}
              ${isPending ? 'opacity-50 cursor-wait' : 'active:scale-[0.97]'}`}
          >
            {isDone ? '↩️ Вернуть' : '✅ Выполнено'}
          </button>
        )}

        {/* Редактировать — только для ручных */}
        {!isAuto && (
          <Link
            href={`/reminders/${r.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
          >
            ✏️ Изменить
          </Link>
        )}

        {/* Отправить в TG — для всех */}
        <button
          type="button"
          onClick={handleSendTg}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-all
                     ${isPending ? 'opacity-50 cursor-wait' : 'active:scale-[0.97]'}`}
        >
          📱 В Telegram
        </button>

        {/* Удалить — для всех */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all
                     ${isPending ? 'opacity-50 cursor-wait' : 'active:scale-[0.97]'}`}
        >
          🗑 Удалить
        </button>
      </div>

      {/* Сообщение TG */}
      {tgMessage && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800">
          {tgMessage}
        </div>
      )}
    </div>
  );
}
