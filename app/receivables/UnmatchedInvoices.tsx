'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, EyeOff } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { linkRemoteInvoice, ignoreRemoteInvoice, linkCorrection } from './actions';

export type UnmatchedRow = {
  externalId: string;
  number: string;
  issueDate: string;
  amount: string;
  buyer: string;
  /** оплачена в сервисе фактур */
  paid?: boolean;
  /** корректа (FK…): добавляется к счёту заказа, а не заменяет его */
  correction?: boolean;
  /** replaces — номер счёта заказа, который эта фактура заменит */
  options: { id: string; label: string; suggested: boolean; replaces?: string | null }[];
};

function Row({ r, canEdit }: { r: UnmatchedRow; canEdit: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [tripId, setTripId] = useState(r.options.find((o) => o.suggested)?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.message ?? null);
      router.refresh();
    });
  const suggested = r.options.filter((o) => o.suggested);
  const rest = r.options.filter((o) => !o.suggested);
  return (
    <tr className="align-top">
      <td className="py-2.5 pr-3 font-medium">
        {r.number}
        {r.correction && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{t('recv2.correction')}</span>}
        {r.paid && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{t('recv2.paidThere')}</span>}
      </td>
      <td className="py-2.5 pr-3 text-slate-600">{r.issueDate}</td>
      <td className="py-2.5 pr-3">{r.buyer}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">{r.amount}</td>
      <td className="py-2.5">
        {canEdit && (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="input text-sm py-1.5 min-w-[14rem]">
                <option value="">{t('recv.chooseTrip')}</option>
                {suggested.length > 0 && (
                  <optgroup label={t('recv.suggestedTrips')}>
                    {suggested.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                )}
                {rest.length > 0 && (
                  <optgroup label={t('recv.otherTrips')}>
                    {rest.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                )}
              </select>
              <button type="button" disabled={isPending || !tripId} onClick={() => {
                  if (r.correction) { act(() => linkCorrection(r.externalId, tripId)); return; }
                  const rep = r.options.find((o) => o.id === tripId)?.replaces;
                  if (rep && !window.confirm(t('recv2.confirmReplace', { old: rep, new: r.number }))) return;
                  act(() => linkRemoteInvoice(r.externalId, tripId));
                }}
                className="btn btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                {r.correction ? t('recv2.addCorrection') : t('recv.linkTrip')}
              </button>
              <button type="button" disabled={isPending} onClick={() => act(() => ignoreRemoteInvoice(r.externalId))}
                title={t('recv.notOrder')} className="btn btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-50">
                <EyeOff className="w-3.5 h-3.5" />
                {t('recv.notOrder')}
              </button>
            </div>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Неоплаченные фактуры сервиса без заказа в CRM — привязать или убрать. */
export default function UnmatchedInvoices({ rows, canEdit, provider, at }: { rows: UnmatchedRow[]; canEdit: boolean; provider: string; at: string }) {
  const { t } = useT();
  if (!rows.length) return null;
  return (
    <section className="card p-4 md:p-5 overflow-x-auto border border-amber-200">
      <h2 className="font-bold text-slate-900">{t('recv.unmatchedTitle', { provider, n: rows.length })}</h2>
      <p className="text-xs text-slate-500 mb-3">{t('recv2.hint', { at })}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="py-2 pr-3">{t('recv.colInvoice')}</th>
            <th className="py-2 pr-3">{t('recv.colDate')}</th>
            <th className="py-2 pr-3">{t('recv.colBuyer')}</th>
            <th className="py-2 pr-3 text-right">{t('recv.colAmount')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => <Row key={r.externalId} r={r} canEdit={canEdit} />)}
        </tbody>
      </table>
    </section>
  );
}
