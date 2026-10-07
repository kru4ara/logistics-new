'use client';

import { useState, useTransition } from 'react';
import { sendTaskToDriver } from './task-actions';

export default function SendTaskButton({
  tripId,
  disabled,
  disabledHint,
}: {
  tripId: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function handleSend() {
    if (isPending || disabled) return;
    setStatus(null);

    startTransition(async () => {
      try {
        const res = await sendTaskToDriver(tripId);
        if (res.success) {
          setStatus({ kind: 'ok', text: '✅ Задание отправлено водителю' });
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus({ kind: 'err', text: '❌ ' + res.error });
        }
      } catch (e) {
        setStatus({ kind: 'err', text: '❌ ' + (e as Error).message });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending || disabled}
        title={disabled ? disabledHint : ''}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
          ${isPending || disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-[0.98]'
          }`}
      >
        {isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Отправка...
          </>
        ) : (
          <>📤 Отправить водителю в Telegram</>
        )}
      </button>

      {disabled && disabledHint && (
        <p className="text-xs text-slate-400 text-center">{disabledHint}</p>
      )}

      {status && (
        <p
          className={`text-xs text-center rounded-lg px-3 py-2 font-medium ${
            status.kind === 'ok'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-red-700 bg-red-50 border border-red-200'
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
