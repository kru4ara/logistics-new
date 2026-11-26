'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Link2 } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { closeTripGap, closeAllTripGaps, keepTripAsIs } from './actions';
import { confirmDialog } from '../../components/Dialogs';

export function CloseGapButton({ tripId }: { tripId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          start(async () => {
            const r = await closeTripGap(tripId);
            setErr(r.ok ? null : r.message ?? null);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-brand-700 border border-brand-200 bg-white hover:bg-brand-50 disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        {t('chain.close')}
      </button>
      {err && <span className="text-[11px] text-red-600 max-w-xs text-right">{err}</span>}
    </span>
  );
}

export function CloseAllGapsButton({ tripIds }: { tripIds: string[] }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start md:items-end gap-1">
      <button
        type="button"
        disabled={isPending || tripIds.length === 0}
        onClick={async () => {
          if (!(await confirmDialog(t('chain.closeAllConfirm', { n: tripIds.length })))) return;
          start(async () => {
            const r = await closeAllTripGaps(tripIds);
            setMsg([t('chain.fixedN', { n: r.fixed ?? 0 }), r.message].filter(Boolean).join(' · '));
            router.refresh();
          });
        }}
        className="btn btn-primary text-sm disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        {t('chain.closeAll', { n: tripIds.length })}
      </button>
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </span>
  );
}

/** «Оставить как есть»: рейс шёл одновременно с другим (сборный груз) или простой — не трогать. */
export function KeepAsIsButton({ tripId }: { tripId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={isPending}
        onClick={async () => {
          if (!(await confirmDialog(t('chain.keepConfirm')))) return;
          start(async () => {
            const r = await keepTripAsIs(tripId);
            setErr(r.ok ? null : r.message ?? null);
            router.refresh();
          });
        }}
        className="inline-flex items-center h-9 px-3 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('chain.keep')}
      </button>
      {err && <span className="text-[11px] text-red-600 max-w-xs text-right">{err}</span>}
    </span>
  );
}
