'use client';

import { useState, useTransition } from 'react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  function handleStatusChange(status: string) {
    if (status === currentStatus || isPending) return;

    // Для «Завершён» — открываем модалку
    if (status === 'completed') {
      setIsModalOpen(true);
      setError(null);
      return;
    }

    // Остальные статусы — сразу
    startTransition(async () => {
      await changeTripStatus(tripId, status);
    });
  }

  function handleCompleteConfirm() {
    if (!endDate) {
      setError('Укажите дату завершения');
      return;
    }

    startTransition(async () => {
      await changeTripStatus(tripId, 'completed', endDate);
      setIsModalOpen(false);
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
    <>
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

      {/* МОДАЛЬНОЕ ОКНО ЗАВЕРШЕНИЯ РЕЙСА */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => !isPending && setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-5xl mb-2">🏁</div>
              <h3 className="text-lg font-bold text-slate-900">Завершить рейс</h3>
              <p className="text-sm text-slate-500 mt-1">
                Укажите дату фактического завершения
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Дата завершения *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-slate-400 mt-1">
                По этой дате будет рассчитан пробег и расход топлива из Logisat
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ❌ {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium
                           hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCompleteConfirm}
                disabled={isPending}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold
                           shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>Подтвердить</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
