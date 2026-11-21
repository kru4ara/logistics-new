'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  CheckCircle2,
  BadgeDollarSign,
  Banknote,
  Flag,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { changeTripStatus } from './trip-status-actions';
import { useT } from '../components/I18nProvider';

type StatusBtn = {
  value: string;
  label: string;
  Icon: LucideIcon;
};

export default function TripStatusButtons({
  tripId,
  currentStatus,
  showAdminStatuses = false,
  invoiceForm = false,
  needCmr = false,
}: {
  tripId: string;
  currentStatus: string;
  showAdminStatuses?: boolean;
  /** «Выставить счёт» ведёт к форме фактуры (#invoice), статус ставит сама фактура */
  invoiceForm?: boolean;
  /** водитель без CMR: «Завершить» ведёт к загрузке CMR (сервер тоже не даст) */
  needCmr?: boolean;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function goToUpload() {
    const el = document.getElementById('upload-docs');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-amber-500');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500'), 2500);
  }

  function handleStatusChange(status: string) {
    if (status === currentStatus || isPending) return;

    // Без CMR водитель рейс не завершает — ведём к загрузке.
    if (status === 'completed' && needCmr) {
      setNotice(t('cmrGate.need'));
      goToUpload();
      return;
    }

    // Для «Завершён» — открываем модалку
    if (status === 'completed') {
      setIsModalOpen(true);
      setError(null);
      return;
    }

    // Счёт выставляется фактурой: ведём к форме, статус поменяется после выставления.
    if (status === 'invoiced' && invoiceForm) {
      const el = document.getElementById('invoice');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-brand-500');
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-brand-500'), 2000);
        el.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true });
        return;
      }
      // Форма фактуры — на вкладке «Счета и оплата» карточки рейса: туда, статус не трогаем.
      router.push(`${window.location.pathname}?tab=money#invoice`);
      return;
    }

    startTransition(async () => {
      await changeTripStatus(tripId, status);
    });
  }

  function handleCompleteConfirm() {
    if (!endDate) {
      setError(t('shared.needEndDate'));
      return;
    }

    startTransition(async () => {
      try {
        await changeTripStatus(tripId, 'completed', endDate);
        setIsModalOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const driverButtons: StatusBtn[] = [
    { value: 'active', label: t('shared.startTrip'), Icon: Truck },
    { value: 'completed', label: t('shared.finish'), Icon: CheckCircle2 },
  ];

  const adminButtons: StatusBtn[] = [
    { value: 'invoiced', label: t('shared.invoice'), Icon: BadgeDollarSign },
    { value: 'paid', label: t('shared.paid'), Icon: Banknote },
  ];

  const buttons = showAdminStatuses
    ? [...driverButtons, ...adminButtons]
    : driverButtons;

  return (
    <>
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
        {buttons.map(({ value, label, Icon }) => {
          const isActive = currentStatus === value;
          const isDisabled = isPending || isActive;

          return (
            <button
              key={value}
              type="button"
              onClick={() => handleStatusChange(value)}
              disabled={isDisabled}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-3 rounded-xl
                          font-semibold text-sm md:text-base transition-all duration-150
                          w-full md:w-auto
                ${isActive
                  ? 'bg-brand-600 text-white shadow-brand cursor-default'
                  : isPending
                    ? 'bg-slate-200 text-slate-400 cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98]'
                }`}
            >
              <Icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span className="text-center leading-tight">{label}</span>
              {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-1 shrink-0" />}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={goToUpload} className="font-semibold text-amber-800 underline underline-offset-2">
            {t('cmrGate.toUpload')}
          </button>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ЗАВЕРШЕНИЯ РЕЙСА */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => !isPending && setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-soft-lg max-w-md w-full p-5 md:p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 mb-3">
                <Flag className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('shared.finishTrip')}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {t('shared.finishHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('shared.endDate')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input w-full text-base"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('shared.endDateHint')}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
                className="btn-secondary flex-1"
              >
                {t('seg.cancel')}
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('seg.saving')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('shared.confirm')}</span>
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
