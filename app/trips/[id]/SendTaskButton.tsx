'use client';

import { useState, useTransition } from 'react';
import { Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
          setStatus({ kind: 'ok', text: 'Задание отправлено водителю' });
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus({ kind: 'err', text: res.error });
        }
      } catch (e) {
        setStatus({ kind: 'err', text: (e as Error).message });
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
            : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand active:scale-[0.98]'
          }`}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Отправить водителю в Telegram
          </>
        )}
      </button>

      {disabled && disabledHint && (
        <p className="text-xs text-slate-400 text-center">{disabledHint}</p>
      )}

      {status && (
        <p
          className={`flex items-center justify-center gap-1.5 text-xs text-center rounded-lg px-3 py-2 font-medium animate-fade-in ${
            status.kind === 'ok'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-red-700 bg-red-50 border border-red-200'
          }`}
        >
          {status.kind === 'ok' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{status.text}</span>
        </p>
      )}
    </div>
  );
}
