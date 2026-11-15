'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LockOpen, Loader2, Check } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { closeMonth, reopenMonth, applyClosedCost } from './actions';

function useRun() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? null);
      router.refresh();
    });
  return { isPending, error, run };
}

export function CloseMonthButton({ month, closed, label }: { month: string; closed: boolean; label: string }) {
  const { t } = useT();
  const { isPending, error, run } = useRun();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(t(closed ? 'pf.reopenConfirm' : 'pf.closeConfirm', { month: label }))) return;
          run(() => (closed ? reopenMonth(month) : closeMonth(month)));
        }}
        className={`btn text-sm disabled:opacity-50 ${closed ? 'btn-secondary' : 'btn-primary'}`}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : closed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        {t(closed ? 'pf.reopen' : 'pf.close')}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function ApplyCostButton({ segmentId }: { segmentId: string }) {
  const { t } = useT();
  const { isPending, run } = useRun();
  return (
    <button type="button" disabled={isPending} onClick={() => run(() => applyClosedCost(segmentId))}
      className="btn btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-50">
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      {t('pf.apply')}
    </button>
  );
}
