'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Link2, CheckCircle2, Undo2, DownloadCloud, Trash2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { syncPurchasesNow, linkPurchase, linkPurchaseToTrip, unlinkPurchase, setPurchasePaid, deleteManualPurchase } from './actions';
import { matchesQuery } from '../../lib/payables/trip-rules';

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

export type PickOption = { id: string; label: string };
/** @deprecated имя для совместимости */
export type SegmentOption = PickOption;
export type CategoryOption = { value: string; label: string };

type Mode = 'segment' | 'trip' | 'none';
const MAX_SHOWN = 60;

/** Список с поиском: подсказки сверху; найденное по всем словам запроса. */
function SearchSelect({ options, suggestedIds, value, onChange, placeholder, suggestedLabel, otherLabel }: {
  options: PickOption[];
  suggestedIds: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestedLabel: string;
  otherLabel: string;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const found = q.trim() ? options.filter((o) => matchesQuery(o.label, q)) : options;
  const byId = new Map(found.map((o) => [o.id, o]));
  const sug = suggestedIds.map((id) => byId.get(id)).filter((o): o is PickOption => Boolean(o));
  const sugSet = new Set(suggestedIds);
  const rest = found.filter((o) => !sugSet.has(o.id)).slice(0, MAX_SHOWN);
  const selected = options.find((o) => o.id === value);
  return (
    <div className="flex flex-col gap-1">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input text-sm py-1.5" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm py-1.5">
        <option value="">{found.length ? t('pay.choose') : t('payx2.nothingFound')}</option>
        {/* выбранный вариант виден, даже если не подходит под поиск */}
        {selected && !found.includes(selected) && <option value={selected.id}>{selected.label}</option>}
        {sug.length > 0 && <optgroup label={suggestedLabel}>{sug.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>}
        {rest.length > 0 && <optgroup label={otherLabel}>{rest.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>}
      </select>
    </div>
  );
}

/**
 * Привязка счёта: к участку перевозчика (оплата перевозки), к рейсу целиком как расход
 * (перегруз, EX-1, EPI, склад) или «не относится к рейсам».
 */
export function LinkPurchaseForm({ invoiceId, segments, suggestedSegments, trips, suggestedTrips, categories, defaultCategory }: {
  invoiceId: string;
  segments: PickOption[];
  suggestedSegments: string[];
  trips: PickOption[];
  suggestedTrips: string[];
  categories: CategoryOption[];
  defaultCategory: string;
}) {
  const { t } = useT();
  const { isPending, msg, run } = useAction();
  const sugSeg = suggestedSegments[0] ?? '';
  const sugTrip = suggestedTrips[0] ?? '';
  const [mode, setMode] = useState<Mode>(sugSeg ? 'segment' : sugTrip ? 'trip' : 'segment');
  const [segment, setSegment] = useState(sugSeg);
  const [trip, setTrip] = useState(sugTrip);
  const [category, setCategory] = useState(defaultCategory);
  const ready = mode === 'none' || (mode === 'segment' ? Boolean(segment) : Boolean(trip && category));
  const submit = () =>
    run(() =>
      mode === 'trip' ? linkPurchaseToTrip(invoiceId, trip, category) : linkPurchase(invoiceId, mode === 'segment' ? segment : null),
    );
  const tab = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)}
      className={`px-2 py-1 text-xs rounded-md border ${mode === m ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5 min-w-[18rem] max-w-md">
      <div className="flex flex-wrap gap-1">
        {tab('segment', t('payx2.modeSegment'))}
        {tab('trip', t('payx2.modeTrip'))}
        {tab('none', t('pay.notTrip'))}
      </div>
      {mode === 'segment' && (
        <SearchSelect options={segments} suggestedIds={suggestedSegments} value={segment} onChange={setSegment} placeholder={t('payx2.searchSegment')}
          suggestedLabel={t('pay.suggested')} otherLabel={t('pay.otherSegments')} />
      )}
      {mode === 'trip' && (
        <>
          <SearchSelect options={trips} suggestedIds={suggestedTrips} value={trip} onChange={setTrip} placeholder={t('payx2.searchTrip')}
            suggestedLabel={t('payx2.suggestedByDate')} otherLabel={t('payx2.otherTrips')} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('payx2.category')}
            className={`input text-sm py-1.5 ${category ? '' : 'border-amber-400 bg-amber-50'}`}>
            <option value="">{t('payx2.chooseCategory')}</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {!category && <p className="text-xs text-amber-700">{t('payx2.categoryUnknown')}</p>}
        </>
      )}
      <div>
        <button type="button" disabled={isPending || !ready} onClick={submit} className="btn btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          {mode === 'none' ? t('payx2.markNotTrip') : t('pay.link')}
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
