'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Link2, CheckCircle2, Undo2, DownloadCloud, Trash2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { syncPurchasesNow, linkPurchase, linkPurchaseToTrip, linkPurchaseToTrips, unlinkPurchase, setPurchasePaid, deleteManualPurchase } from './actions';
import { matchesQuery, splitEvenly, validateAllocations, type Allocation } from '../../lib/payables/trip-rules';

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

/** Несколько рейсов с долями счёта: галочки (поиск, рейсы периода сверху) и суммы. */
function TripSplitPicker({ options, suggestedIds, total, currency, value, onChange }: {
  options: PickOption[];
  suggestedIds: string[];
  total: number;
  currency: string;
  value: Allocation[];
  onChange: (v: Allocation[]) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const chosen = new Set(value.map((a) => a.tripId));
  const byId = new Map(options.map((o) => [o.id, o]));
  const found = q.trim() ? options.filter((o) => matchesQuery(o.label, q)) : options;
  const sugSet = new Set(suggestedIds);
  const list = [
    ...suggestedIds.map((id) => byId.get(id)).filter((o): o is PickOption => Boolean(o) && found.includes(o!)),
    ...found.filter((o) => !sugSet.has(o.id)).slice(0, MAX_SHOWN),
  ];
  const even = (ids: string[]) => {
    const parts = splitEvenly(total, ids.length);
    return ids.map((id, i) => ({ tripId: id, amount: parts[i] }));
  };
  const toggle = (id: string) => {
    const ids = chosen.has(id) ? value.map((a) => a.tripId).filter((x) => x !== id) : [...value.map((a) => a.tripId), id];
    onChange(even(ids));
  };
  const sum = Math.round(value.reduce((x, a) => x + (Number.isFinite(a.amount) ? a.amount : 0), 0) * 100) / 100;
  const off = Math.abs(sum - total) > 0.01;
  return (
    <div className="flex flex-col gap-1.5">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('payx2.searchTrip')} className="input text-sm py-1.5" />
      <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50 bg-white">
        {list.length === 0 && <p className="p-2 text-xs text-slate-400">{t('payx2.nothingFound')}</p>}
        {list.map((o) => (
          <label key={o.id} className="flex items-start gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={chosen.has(o.id)} onChange={() => toggle(o.id)} className="mt-0.5" />
            <span className={sugSet.has(o.id) ? 'font-medium text-slate-900' : 'text-slate-600'}>{o.label}</span>
          </label>
        ))}
      </div>
      {suggestedIds.length > 0 && <p className="text-[11px] text-slate-400">{t('payx4.periodHint', { n: suggestedIds.length })}</p>}
      {value.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/50">
          {value.map((a, i) => (
            <div key={a.tripId} className="flex items-center gap-2 text-xs">
              <span className="flex-1 min-w-0 truncate">{byId.get(a.tripId)?.label ?? a.tripId}</span>
              <input type="number" step="0.01" min="0.01" value={Number.isFinite(a.amount) ? a.amount : ''} aria-label={t('payx4.share')}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, amount: e.target.value === '' ? NaN : Number(e.target.value) } : x)))}
                className="input text-xs py-0.5 px-1.5 w-24 text-right tabular-nums" />
              <span className="text-slate-400 w-8">{currency}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <button type="button" onClick={() => onChange(even(value.map((a) => a.tripId)))} className="text-brand-600 hover:underline">{t('payx4.evenly')}</button>
            <span className={off ? 'text-red-600 font-semibold' : 'text-slate-500'}>
              {t('payx4.sum', { sum: sum.toFixed(2), total: total.toFixed(2), cur: currency })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Привязка счёта: к участку перевозчика (оплата перевозки), к рейсу целиком как расход
 * (перегруз, EX-1, EPI, склад) или «не относится к рейсам».
 */
export function LinkPurchaseForm({ invoiceId, segments, suggestedSegments, trips, suggestedTrips, periodTrips, total, currency, categories, defaultCategory }: {
  invoiceId: string;
  /** рейсы периода месячного счёта — подсказка для разделения */
  periodTrips: string[];
  /** нетто счёта — делится между рейсами */
  total: number;
  currency: string;
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
  const [split, setSplit] = useState(false);
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const splitOk = allocs.length >= 2 && validateAllocations(total, allocs) === null;
  const ready =
    mode === 'none' || (mode === 'segment' ? Boolean(segment) : Boolean(category) && (split ? splitOk : Boolean(trip)));
  const submit = () =>
    run(() =>
      mode === 'trip'
        ? split
          ? linkPurchaseToTrips(invoiceId, allocs, category)
          : linkPurchaseToTrip(invoiceId, trip, category)
        : linkPurchase(invoiceId, mode === 'segment' ? segment : null),
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
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
            {t('payx4.splitToggle')}
          </label>
          {split ? (
            <TripSplitPicker options={trips} suggestedIds={periodTrips} total={total} currency={currency} value={allocs} onChange={setAllocs} />
          ) : (
            <SearchSelect options={trips} suggestedIds={suggestedTrips} value={trip} onChange={setTrip} placeholder={t('payx2.searchTrip')}
              suggestedLabel={t('payx2.suggestedByDate')} otherLabel={t('payx2.otherTrips')} />
          )}
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
          {mode === 'none' ? t('payx2.markNotTrip') : mode === 'trip' && split ? t('payx4.splitSubmit', { n: allocs.length }) : t('pay.link')}
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
