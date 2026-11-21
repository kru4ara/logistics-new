'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Check, Undo2, Ban, Trash2, Link2, CheckCheck, RefreshCw } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { uploadStatements, decideTransaction, acceptSuggestions, undoTransaction, deleteStatement, rematchTransactions } from './actions';

export type PickOpt = { id: string; label: string; /** остаток к оплате заказа */ due?: number };
type Cat = { value: string; label: string };
type Suggestion =
  | { type: 'purchases'; ids: string[]; exact: boolean }
  | { type: 'trips'; ids: string[]; exact: boolean; allocations?: { tripId: string; amount: number }[]; remainder?: number }
  | { type: 'cash' }
  | { type: 'overhead'; category: string }
  | { type: 'ignore' }
  | null;

function useRun() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message ? { ok: r.ok, text: r.message } : null);
      router.refresh();
    });
  return { isPending, msg, run };
}

/** Загрузить PDF-выписки PKO (можно несколько сразу). */
export function UploadStatements() {
  const { t } = useT();
  const { isPending, msg, run } = useRun();
  const ref = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  return (
    <form ref={ref} className="flex flex-col items-start md:items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(async () => {
          const r = await uploadStatements(fd);
          ref.current?.reset();
          setCount(0);
          return r;
        });
      }}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-secondary text-sm cursor-pointer">
          <input type="file" name="files" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => setCount(e.target.files?.length ?? 0)} />
          {count ? t('bank.filesChosen', { n: count }) : t('bank.chooseFiles')}
        </label>
        <button type="submit" disabled={isPending || !count} className="btn btn-primary text-sm disabled:opacity-50">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {t('bank.upload')}
        </button>
      </div>
      <p className="text-xs text-slate-400">{t('bank.uploadHint')}</p>
      {msg && <p className={`text-xs whitespace-pre-line ${msg.ok ? 'text-slate-700' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  );
}

/** Решение по операции: принять подсказку, связать вручную, в общие расходы, пропустить; или отменить. */
export function TxActions({ txId, status, outgoing, suggestion, picks, categories, incomeCategories = [], amount, currency }: {
  txId: string;
  status: string;
  outgoing: boolean;
  amount: number;
  currency: string;
  suggestion: Suggestion;
  picks: PickOpt[];
  categories: Cat[];
  /** прочие доходы — для прихода не от клиента по счёту */
  incomeCategories?: Cat[];
}) {
  const { t } = useT();
  const { isPending, msg, run } = useRun();
  const [pick, setPick] = useState('');
  const [cat, setCat] = useState(suggestion?.type === 'overhead' ? suggestion.category : '');
  const [inc, setInc] = useState('');
  const btn = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap disabled:opacity-50';
  const spin = <Loader2 className="w-3.5 h-3.5 animate-spin" />;

  if (status !== 'new') {
    return (
      <div className="flex flex-col items-start lg:items-end gap-1">
        <button type="button" disabled={isPending} onClick={() => run(() => undoTransaction(txId))} className={`${btn} text-slate-600 bg-white border-slate-200 hover:bg-slate-50`}>
          {isPending ? spin : <Undo2 className="w-3.5 h-3.5" />}{t('bank.undo')}
        </button>
        {msg && !msg.ok && <p className="text-xs text-red-600">{msg.text}</p>}
      </div>
    );
  }
  const accept = () => {
    if (!suggestion) return;
    run(() =>
      decideTransaction(
        txId,
        suggestion.type === 'trips'
          ? { type: 'trips', ids: suggestion.ids, allocations: suggestion.allocations }
          : suggestion.type === 'purchases'
          ? { type: 'purchases', ids: suggestion.ids }
          : suggestion.type === 'overhead'
            ? { type: 'overhead', category: suggestion.category }
            : suggestion.type === 'cash'
              ? { type: 'cash' }
              : { type: 'ignore' },
      ),
    );
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {suggestion && !(suggestion.type === 'trips' && !suggestion.exact) && (
          <button type="button" disabled={isPending} onClick={accept} className={`${btn} text-white bg-brand-600 border-brand-600 hover:bg-brand-700`}>
            {isPending ? spin : <Check className="w-3.5 h-3.5" />}{t('bank.accept')}
          </button>
        )}
        {outgoing && suggestion?.type !== 'cash' && (
          <button type="button" disabled={isPending} onClick={() => run(() => decideTransaction(txId, { type: 'cash' }))} title={t('bank.cashHint')} className={`${btn} text-slate-600 bg-white border-slate-200 hover:bg-slate-50`}>
            💵 {t('bank.cashBtn')}
          </button>
        )}
        <button type="button" disabled={isPending} onClick={() => run(() => decideTransaction(txId, { type: 'ignore' }))} className={`${btn} text-slate-600 bg-white border-slate-200 hover:bg-slate-50`}>
          <Ban className="w-3.5 h-3.5" />{t('bank.skip')}
        </button>
      </div>
      {!outgoing && (
        <AllocationEditor
          picks={picks}
          amount={amount}
          currency={currency}
          initial={suggestion?.type === 'trips' ? suggestion.allocations ?? [] : []}
          busy={isPending}
          onSubmit={(allocations) => run(() => decideTransaction(txId, { type: 'trips', ids: allocations.map((a) => a.tripId), allocations }))}
        />
      )}
      {outgoing && picks.length > 0 && (
        <div className="flex gap-1">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={outgoing ? t('bank.pickInvoice') : t('bank.pickTrip')} className="input text-xs py-1 min-w-0 flex-1">
            <option value="">{outgoing ? t('bank.pickInvoice') : t('bank.pickTrip')}</option>
            {picks.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="button" disabled={isPending || !pick} onClick={() => run(() => decideTransaction(txId, { type: 'purchases', ids: [pick] }))} className={`${btn} text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100`}>
            <Link2 className="w-3.5 h-3.5" />{t('bank.link')}
          </button>
        </div>
      )}
      {outgoing && (
        <div className="flex gap-1">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('bank.overheadCat')} className="input text-xs py-1 min-w-0 flex-1">
            <option value="">{t('bank.overheadCat')}</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="button" disabled={isPending || !cat} onClick={() => run(() => decideTransaction(txId, { type: 'overhead', category: cat }))} className={`${btn} text-slate-700 bg-white border-slate-200 hover:bg-slate-50`}>
            {t('bank.toOverheadBtn')}
          </button>
        </div>
      )}
      {!outgoing && incomeCategories.length > 0 && (
        <div className="flex gap-1">
          <select value={inc} onChange={(e) => setInc(e.target.value)} aria-label={t('income.pick')} className="input text-xs py-1 min-w-0 flex-1">
            <option value="">{t('income.pick')}</option>
            {incomeCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="button" disabled={isPending || !inc} onClick={() => run(() => decideTransaction(txId, { type: 'income', category: inc }))} className={`${btn} text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100`}>
            {t('income.toIncome')}
          </button>
        </div>
      )}
      {msg && !msg.ok && <p className="text-xs text-red-600">{msg.text}</p>}
    </div>
  );
}

/** Принять все подсказки (выписки или всех выписок). */
export function AcceptAllButton({ statementId, count }: { statementId: string | null; count: number }) {
  const { t } = useT();
  const { isPending, msg, run } = useRun();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={isPending}
        onClick={() => window.confirm(t('bank.confirmAcceptAll', { n: count })) && run(() => acceptSuggestions(statementId))}
        className="btn btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
        {t('bank.acceptAll', { n: count })}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
    </span>
  );
}

/** Удалить выписку (решения по её операциям отменяются). */
export function DeleteStatementButton({ statementId, label }: { statementId: string; label: string }) {
  const { t } = useT();
  const { isPending, msg, run } = useRun();
  return (
    <>
      <button type="button" disabled={isPending} title={t('bank.deleteStatement')} aria-label={t('bank.deleteStatement')}
        onClick={() => window.confirm(t('bank.confirmDelete', { label })) && run(() => deleteStatement(statementId))}
        className="text-slate-400 hover:text-red-600 disabled:opacity-50">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
      {msg && !msg.ok && <span className="text-xs text-red-600">{msg.text}</span>}
    </>
  );
}

/** Пересчитать подсказки (после загрузки новых счетов или правки данных). */
export function RematchButton() {
  const { t } = useT();
  const { isPending, msg, run } = useRun();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={isPending} onClick={() => run(() => rematchTransactions())}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-slate-600 bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-50">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {t('bank.rematch')}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
    </span>
  );
}

/**
 * Распределение прихода по заказам: каждому — сумма (по умолчанию его остаток), остаток
 * прихода без распределения — аванс клиента.
 */
function AllocationEditor({ picks, amount, currency, initial, busy, onSubmit }: {
  picks: PickOpt[];
  amount: number;
  currency: string;
  initial: { tripId: string; amount: number }[];
  busy: boolean;
  onSubmit: (a: { tripId: string; amount: number }[]) => void;
}) {
  const { t } = useT();
  const [rows, setRows] = useState(initial.map((a) => ({ tripId: a.tripId, amount: String(a.amount) })));
  const [add, setAdd] = useState('');
  const [q, setQ] = useState('');
  const byId = new Map(picks.map((p) => [p.id, p]));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = picks
    .filter((p) => !rows.some((r) => r.tripId === p.id))
    .filter((p) => words.every((w) => p.label.toLowerCase().includes(w)))
    .slice(0, 60);
  const cents = (v: string) => Math.round((Number(v.replace(',', '.')) || 0) * 100);
  const used = rows.reduce((s, r) => s + cents(r.amount), 0);
  const left = Math.round(amount * 100) - used;
  const over = left < 0;
  const addTrip = () => {
    if (!add || rows.some((r) => r.tripId === add)) return;
    const due = Math.round((byId.get(add)?.due ?? 0) * 100);
    const share = Math.max(0, Math.min(due || left, left));
    setRows([...rows, { tripId: add, amount: (share / 100).toFixed(2) }]);
    setAdd('');
  };
  const valid = rows.length > 0 && !over && rows.every((r) => cents(r.amount) > 0);
  return (
    <div className="border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50/50">
      {rows.map((r, i) => (
        <div key={r.tripId} className="flex items-center gap-1.5 text-xs">
          <span className="flex-1 min-w-0 truncate" title={byId.get(r.tripId)?.label}>{byId.get(r.tripId)?.label ?? r.tripId.slice(0, 8)}</span>
          <input type="text" inputMode="decimal" value={r.amount} aria-label={t('pay2.share')}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
            className="input text-xs py-0.5 px-1.5 w-24 text-right tabular-nums" />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('pay2.removeShare')} className="text-slate-400 hover:text-red-600">✕</button>
        </div>
      ))}
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pay2.searchTrip')} className="input text-xs py-1 w-full" />
      <div className="flex gap-1">
        <select value={add} onChange={(e) => setAdd(e.target.value)} aria-label={t('bank.pickTrip')} className="input text-xs py-1 min-w-0 flex-1">
          <option value="">{shown.length ? t('bank.pickTrip') : t('payx2.nothingFound')}</option>
          {shown.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button type="button" disabled={!add} onClick={addTrip} className="px-2 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50">+</button>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={over ? 'text-red-600 font-semibold' : left > 0 ? 'text-amber-700' : 'text-slate-500'}>
          {over ? t('pay2.over', { sum: (-left / 100).toFixed(2), cur: currency }) : left > 0 ? t('pay2.advance', { sum: (left / 100).toFixed(2), cur: currency }) : t('pay2.allSpread')}
        </span>
        <button type="button" disabled={busy || !valid}
          onClick={() => onSubmit(rows.map((r) => ({ tripId: r.tripId, amount: cents(r.amount) / 100 })))}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}{t('pay2.spread')}
        </button>
      </div>
    </div>
  );
}
