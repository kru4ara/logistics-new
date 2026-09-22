'use client';

import { useTransition } from 'react';
import { changeTripStatus } from './trip-status-actions';

type StatusBtn = {
  value: string;
  label: string;
  emoji: string;
};

export default function TripStatusButtons({
  tripId,
  currentStatus,
  showAdminStatuses = false,
}: {
  tripId: string;
  currentStatus: string;
  showAdminStatuses?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: string) {
    if (status === currentStatus || isPending) return;
    startTransition(async () => {
      await changeTripStatus(tripId, status);
    });
  }

  const driverButtons: StatusBtn[] = [
    { value: 'active', label: 'Начать рейс', emoji: '🚛' },
    { value: 'completed', label: 'Завершить', emoji: '✅' },
  ];

  const adminButtons: StatusBtn[] = [
    { value: 'invoiced', label: 'Выставить счёт', emoji: '💰' },
    { value: 'paid', label: 'Оплачен', emoji: '💶' },
  ];

  const buttons = showAdminStatuses
    ? [...driverButtons, ...adminButtons]
    : driverButtons;

  return (
    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
      {buttons.map((btn) => {
        const isActive = currentStatus === btn.value;
        const isDisabled = isPending || isActive;

        return (
          <button
            key={btn.value}
            type="button"
            onClick={() => handleStatusChange(btn.value)}
            disabled={isDisabled}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-3 rounded-xl
                        font-semibold text-sm md:text-base transition-all duration-150
                        w-full md:w-auto
              ${isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 cursor-default'
                : isPending
                  ? 'bg-slate-200 text-slate-400 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98]'
              }`}
          >
            <span className="text-base md:text-lg">{btn.emoji}</span>
            <span className="truncate">{btn.label}</span>
            {isActive && <span className="text-xs ml-1">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
