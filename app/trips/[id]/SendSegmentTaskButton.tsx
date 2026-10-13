'use client';

import { useState, useTransition } from 'react';
import { Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { sendSegmentTaskToDriver } from './task-actions';

export default function SendSegmentTaskButton({
  tripId,
  segmentId,
  disabled,
  disabledHint,
}: {
  tripId: string;
  segmentId: string;
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
        const res = await sendSegmentTaskToDriver(tripId, segmentId);
        if (res.success) {
          setStatus({ kind: 'ok', text: 'Отправлено' });
          setTimeout(() => setStatus(null), 5000);
        } else {
          setStatus({ kind: 'err', text: res.error });
        }
      } catch (e) {
        setStatus({ kind: 'err', text: (e as Error).message });
      }
    });
  }

  if (status?.kind === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       bg-emerald-50 text-emerald-700 border border-emerald-200 animate-fade-in">
        <CheckCircle2 className="w-3 h-3" strokeWidth={2.2} />
        {status.text}
      </span>
    );
  }

  if (status?.kind === 'err') {
    return (
      <span
        title={status.text}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                   bg-red-50 text-red-700 border border-red-200 animate-fade-in cursor-help max-w-[240px]">
        <XCircle className="w-3 h-3 shrink-0" strokeWidth={2.2} />
        <span className="truncate">{status.text}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={isPending || disabled}
      title={disabled ? disabledHint : 'Отправить задание водителю этого участка в Telegram'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
        ${isPending || disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.97]'}`}
    >
      {isPending ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Отправка...
        </>
      ) : (
        <>
          <Send className="w-3 h-3" strokeWidth={2.2} />
          Отправить
        </>
      )}
    </button>
  );
}
