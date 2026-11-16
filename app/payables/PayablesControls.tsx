'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Link2, CheckCircle2, Undo2, DownloadCloud, Trash2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { syncPurchasesNow, linkPurchase, unlinkPurchase, setPurchasePaid, deleteManualPurchase } from './actions';

type Res = { ok: boolean; message?: string };

function useAction() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message ? { ok: r.ok, text: r.message } : null);
      router.refresh();
    });
  return { isPending, msg, run };
}

/** «Загрузить из KSeF» + догрузка прошлого периода «с даты». */
export function SyncPurchasesButton() {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  const [since, setSince] = useState('');
  return (
    <div className="flex flex-col items-start md:items-end gap-1">
      <button type="button" disabled={isPending} onClick={() => run(() => syncPurchasesNow())} className="btn btn-secondary text-sm disabled:opacity-50">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
        {t('pay.sync')}
      </button>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span>{t('pay.backfill')}</span>
        <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="input text-xs py-1 px-2 w-36" />
        <button type="button" disabled={isPending || !since} onClick={() => run(() => syncPurchasesNow(since))}
          className="btn btn-secondary text-xs px-2 py-1 disabled:opacity-50">{t('pay.backfillGo')}</button>
      </div>
      {msg && <p className={`text-xs max-w-md ${msg.ok ? 'text-slate-600' : 'text-red-600'}`}>{msg.text}</p>}
      <p className="text-[11px] text-slate-400">{t('pay.syncAuto')}</p>
    </div>
  );
}

export type SegmentOption = { id: string; label: string; suggested: boolean };

/** Выбор участка подрядчика для счёта: подсказки сверху, «не относится к рейсам» — внизу. */
export function LinkPurchaseForm({ invoiceId, options }: { invoiceId: string; options: SegmentOption[] }) {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  const [value, setValue] = useState(options.find((o) => o.suggested)?.id ?? '');
  const suggested = options.filter((o) => o.suggested);
  const rest = options.filter((o) => !o.suggested);
  return (
    <div className="flex flex-col gap-1 min-w-[16rem]">
      <div className="flex items-center gap-2">
        <select value={value} onChange={(e) => setValue(e.target.value)} className="input text-sm py-1.5">
          <option value="">{t('pay.choose')}</option>
          {suggested.length > 0 && (
            <optgroup label={t('pay.suggested')}>
              {suggested.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          )}
          {rest.length > 0 && (
            <optgroup label={t('pay.otherSegments')}>
              {rest.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          )}
          <option value="__none">{t('pay.notTrip')}</option>
        </select>
        <button
          type="button"
          disabled={isPending || !value}
          onClick={() => run(() => linkPurchase(invoiceId, value === '__none' ? null : value))}
          className="btn btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          {t('pay.link')}
        </button>
      </div>
      {msg && !msg.ok && <p className="text-xs text-red-600">{msg.text}</p>}
    </div>
  );
}

export function UnlinkButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useT();
  const { isPending, run } = useAction();
  return (
    <button type="button" disabled={isPending} onClick={() => run(() => unlinkPurchase(invoiceId))} title={t('pay.unlink')}
      className="text-slate-400 hover:text-slate-700 disabled:opacity-50">
      <Undo2 className="w-3.5 h-3.5" />
    </button>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Неоплаченный счёт: дата оплаты (по умолчанию сегодня; по выписке — любая прошлая) + «Оплачено».
 * Оплаченный — «Снять оплату».
 */
export function PurchasePaidButton({ invoiceId, paid }: { invoiceId: string; paid: boolean }) {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  const [date, setDate] = useState(todayIso);
  const btn = `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap disabled:opacity-50 ${
    paid ? 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
  }`;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1.5">
        {!paid && (
          <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)}
            aria-label={t('payx.paidDate')} className="input text-xs py-1 px-2 w-[8.5rem]" />
        )}
        <button type="button" disabled={isPending || (!paid && !date)}
          onClick={() => run(() => setPurchasePaid(invoiceId, !paid, paid ? undefined : date))} className={btn}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : paid ? <Undo2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {paid ? t('pay.unpay') : t('pay.markPaid')}
        </button>
      </div>
      {msg && !msg.ok && <p className="text-xs text-red-600">{msg.text}</p>}
    </div>
  );
}

/** Дата оплаты оплаченного счёта — поправить (например, все отмечены одним днём). */
export function PaidDateInput({ invoiceId, value }: { invoiceId: string; value: string }) {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
        {t('payx.paidLabel')}
        <input type="date" defaultValue={value} max={todayIso()} disabled={isPending} aria-label={t('payx.paidDate')}
          onChange={(e) => e.target.value && e.target.value !== value && run(() => setPurchasePaid(invoiceId, true, e.target.value))}
          className="input text-xs py-0.5 px-1.5 w-[8.5rem] disabled:opacity-50" />
      </span>
      {msg && !msg.ok && <span className="text-xs text-red-600">{msg.text}</span>}
    </span>
  );
}

/** Удалить ручную запись-дубль (с подтверждением). */
export function DeleteManualButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" disabled={isPending}
        onClick={() => window.confirm(t('payx.confirmDelete')) && run(() => deleteManualPurchase(invoiceId))}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        {t('payx.deleteManual')}
      </button>
      {msg && !msg.ok && <span className="text-xs text-red-600">{msg.text}</span>}
    </span>
  );
}
