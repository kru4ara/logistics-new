'use client';

import { useTransition } from 'react';
import { setForwardingStatus } from '../actions';

const allStatuses: { value: string; label: string; emoji: string; color: string }[] = [
  { value: 'planned', label: 'Планируется', emoji: '📋', color: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
  { value: 'active', label: 'В пути', emoji: '🚚', color: 'bg-blue-100 hover:bg-blue-200 text-blue-700' },
  { value: 'completed', label: 'Завершена', emoji: '✅', color: 'bg-green-100 hover:bg-green-200 text-green-700' },
  { value: 'invoiced', label: 'Выставлен счёт', emoji: '📄', color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700' },
  { value: 'paid', label: 'Оплачена', emoji: '💰', color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' },
];

export default function ForwardingStatusButtons({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(status: string) {
    if (status === currentStatus || isPending) return;
    startTransition(async () => {
      await setForwardingStatus(orderId, status);
    });
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2">
        Изменить статус
      </div>
      <div className="flex flex-wrap gap-2">
        {allStatuses.map((s) => {
          const isActive = s.value === currentStatus;
          return (
            <button
              key={s.value}
              type="button"
              disabled={isPending}
              onClick={() => handleClick(s.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-300'
                  : s.color}
                ${isPending ? 'opacity-50 cursor-wait' : 'active:scale-[0.97]'}`}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {isActive && <span className="text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
