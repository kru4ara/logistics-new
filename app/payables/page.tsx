import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReceiptText, AlertTriangle, Link2Off, Inbox, KeyRound, Copy } from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { fetchAll } from '../../lib/fetch-all';
import { getSessionContext } from '../../lib/session';
import { can, deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import { INTL_LOCALE } from '../../lib/i18n/config';
import { formatDate } from '../../lib/i18n/format';
import { isKsefConfigured } from '../../lib/ksef/client';
import { loadSegmentCandidates } from '../../lib/payables/sync';
import { suggestSegments, carrierOrderNumber, type SegmentCandidate } from '../../lib/payables/match-rules';
import { summarizePayables, type PayableRow } from '../../lib/payables/summary';
import { SyncPurchasesButton, LinkPurchaseForm, UnlinkButton, PurchasePaidButton, PaidDateInput, DeleteManualButton, type SegmentOption } from './PayablesControls';
import { findDuplicateGroups } from '../../lib/payables/duplicate-rules';

export const dynamic = 'force-dynamic';

export default async function PayablesPage() {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'payables.view');
  if (denied) redirect(denied);
  const canEdit = can(role, 'payables.edit');
  const { t, locale } = await getT();
  const money = (n: number | null, cur: string | null) =>
    n == null
      ? '—'
      : new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: cur || 'PLN', maximumFractionDigits: 2 }).format(n);

  const supabase = await createClient();
  const { data, error } = await fetchAll(
    supabase
      .from('purchase_invoices')
      .select('id, ksef_number, source, invoice_number, issue_date, seller_nip, seller_name, net_amount, gross_amount, currency, payment_due, description, segment_id, match_status, paid_at')
      .order('issue_date', { ascending: false }),
  );
  if (error) {
    return (
      <div className="p-8 text-red-600">
        {t('trip.loadError', { msg: error.message })}
        {/does not exist|schema cache/i.test(error.message) && <div className="text-sm mt-2">{t('pay.needMigration')}</div>}
      </div>
    );
  }
  const rows = ((data ?? []) as any[]).map(
    (r): PayableRow => ({
      ...r,
      net_amount: r.net_amount != null ? Number(r.net_amount) : null,
      gross_amount: r.gross_amount != null ? Number(r.gross_amount) : null,
    }),
  );
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarizePayables(rows, today);
  const duplicates = findDuplicateGroups(rows);

  const linkedIds = rows.map((r) => r.segment_id).filter((x): x is string => Boolean(x));
  const segments: SegmentCandidate[] = sum.unmatched.length || linkedIds.length ? await loadSegmentCandidates(supabase, linkedIds) : [];
  const segById = new Map(segments.map((s) => [s.id, s]));
  const segLabel = (s: SegmentCandidate) =>
    [
      `№${carrierOrderNumber(s)}${s.linked ? ' ✓' : ''}`,
      s.contractorName,
      s.price != null ? money(s.price, s.currency) : null,
      s.dateTo ? formatDate(s.dateTo, locale) : null,
    ].filter(Boolean).join(' · ');

  const options = (r: PayableRow): SegmentOption[] => {
    const sug = suggestSegments(
      { sellerNip: r.seller_nip, invoiceNumber: r.invoice_number, issueDate: r.issue_date, net: r.net_amount, gross: r.gross_amount, currency: r.currency, description: r.description },
      segments,
    ).slice(0, 5);
    const sugIds = new Set(sug.map((x) => x.segmentId));
    // Участки с уже привязанным счётом тоже доступны: доплата, korekta.
    const free = segments.filter((s) => !sugIds.has(s.id)).slice(0, 200);
    return [
      ...sug.map((x) => ({ id: x.segmentId, label: segLabel(segById.get(x.segmentId)!), suggested: true })),
      ...free.map((s) => ({ id: s.id, label: segLabel(s), suggested: false })),
    ];
  };

  const dueCell = (r: PayableRow) => {
    if (r.paid_at)
      return canEdit
        ? <PaidDateInput key={r.paid_at} invoiceId={r.id} value={r.paid_at} />
        : <span className="text-emerald-700">{t('pay.paidOn', { date: formatDate(r.paid_at, locale) })}</span>;
    if (!r.payment_due) return <span className="text-slate-400">{t('recv.noDue')}</span>;
    const d = Math.round((Date.parse(today) - Date.parse(r.payment_due)) / 86_400_000);
    const cls = d > 0 ? 'text-red-600 font-semibold' : d >= -7 ? 'text-amber-600' : 'text-slate-600';
    return (
      <span className={cls}>
        {formatDate(r.payment_due, locale)}
        <span className="block text-xs">{d > 0 ? t('recv.daysOverdue', { n: d }) : d === 0 ? t('recv.dueToday') : t('recv.daysLeft', { n: -d })}</span>
      </span>
    );
  };

  const head = (
    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
      <th className="py-2 pr-3">{t('pay.seller')}</th>
      <th className="py-2 pr-3">{t('pay.number')}</th>
      <th className="py-2 pr-3 text-right">{t('pay.amount')}</th>
      <th className="py-2 pr-3">{t('pay.due')}</th>
      <th className="py-2 pr-3">{t('pay.order')}</th>
      <th className="py-2" />
    </tr>
  );

  const invoiceCells = (r: PayableRow) => (
    <>
      <td className="py-2.5 pr-3">
        <div className="font-medium text-slate-900">{r.seller_name ?? '—'}</div>
        <div className="text-xs text-slate-400">{r.seller_nip}</div>
      </td>
      <td className="py-2.5 pr-3">
        <div>
          {r.invoice_number ?? '—'}
          {r.source === 'manual' && <span className="ml-1.5 text-[10px] uppercase text-slate-400">{t('pay.srcManual')}</span>}
        </div>
        <div className="text-xs text-slate-400">{r.issue_date ? formatDate(r.issue_date, locale) : ''}</div>
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">
        {money(r.gross_amount, r.currency)}
        {r.net_amount != null && r.gross_amount != null && r.net_amount !== r.gross_amount && (
          <div className="text-xs text-slate-400">{t('pay.net')} {money(r.net_amount, r.currency)}</div>
        )}
      </td>
      <td className="py-2.5 pr-3 whitespace-nowrap">{dueCell(r)}</td>
    </>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <ReceiptText className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              {t('pay.title')}
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">{t('pay.hint')}</p>
          </div>
          {canEdit && isKsefConfigured() && <SyncPurchasesButton />}
        </div>

        {!isKsefConfigured() && (
          <div className="card p-4 flex gap-3 text-sm text-slate-700">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
            <div>{t('pay.notConfigured')}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('pay.kpiUnpaid')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {sum.unpaidByCurrency.length ? sum.unpaidByCurrency.map((c) => money(c.amount, c.currency)).join(' · ') : '—'}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-500" />{t('pay.kpiOverdue')}</div>
            <div className="text-xl font-bold text-red-600 tabular-nums">
              {sum.overdueByCurrency.length ? sum.overdueByCurrency.map((c) => money(c.amount, c.currency)).join(' · ') : '—'}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Link2Off className="w-3.5 h-3.5 text-amber-500" />{t('pay.kpiUnmatched')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{sum.unmatched.length}</div>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="card p-10 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" strokeWidth={1.8} />
            <div className="font-semibold text-slate-700">{t('pay.empty')}</div>
          </div>
        )}

        {duplicates.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto border-amber-300 bg-amber-50/40">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Copy className="w-4 h-4 text-amber-600" />{t('payx.secDupes', { n: duplicates.length })}</h2>
            <p className="text-sm text-slate-600 mt-1 mb-3">{t('payx.dupesHint')}</p>
            <table className="w-full text-sm">
              <thead>{head}</thead>
              {duplicates.map((g, gi) => (
                <tbody key={gi} className="divide-y divide-slate-100 border-b-2 border-amber-200">
                  {g.map((r) => {
                    const seg = r.segment_id ? segById.get(r.segment_id) : null;
                    return (
                      <tr key={r.id} className="align-top">
                        {invoiceCells(r)}
                        <td className="py-2.5 pr-3">
                          {seg ? <Link href={`/trips/${seg.tripId}`} className="text-brand-600 hover:underline">№{carrierOrderNumber(seg)}</Link> : '—'}
                        </td>
                        <td className="py-2.5 text-right">{canEdit && r.source === 'manual' && <DeleteManualButton invoiceId={r.id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </section>
        )}

        {sum.unmatched.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-1">{t('pay.secUnmatched')}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('pay.secUnmatchedHint')}</p>
            <table className="w-full text-sm">
              <thead>{head}</thead>
              <tbody className="divide-y divide-slate-100">
                {sum.unmatched.map((r) => (
                  <tr key={r.id} className="align-top">
                    {invoiceCells(r)}
                    <td className="py-2.5 pr-3" colSpan={2}>
                      {canEdit ? <LinkPurchaseForm invoiceId={r.id} options={options(r)} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {sum.toPay.length > 0 && (
          <section className="card p-4 md:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-3">{t('pay.secToPay')}</h2>
            <table className="w-full text-sm">
              <thead>{head}</thead>
              <tbody className="divide-y divide-slate-100">
                {sum.toPay.map((r) => {
                  const seg = r.segment_id ? segById.get(r.segment_id) : null;
                  return (
                    <tr key={r.id} className="align-top">
                      {invoiceCells(r)}
                      <td className="py-2.5 pr-3">
                        {seg ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Link href={`/trips/${seg.tripId}`} className="text-brand-600 hover:underline">№{carrierOrderNumber(seg)}</Link>
                            {r.match_status === 'auto' && <span className="text-[10px] uppercase text-slate-400">{t('pay.auto')}</span>}
                            {canEdit && <UnlinkButton invoiceId={r.id} />}
                          </span>
                        ) : r.match_status === 'ignored' ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">{t('pay.notTrip')}{canEdit && <UnlinkButton invoiceId={r.id} />}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 text-right">{canEdit && <PurchasePaidButton invoiceId={r.id} paid={false} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {sum.paidRecent.length > 0 && (
          <details className="card p-4 md:p-5 overflow-x-auto">
            <summary className="font-bold text-slate-900 cursor-pointer">{t('pay.secPaid', { n: sum.paidRecent.length })}</summary>
            <table className="w-full text-sm mt-3">
              <thead>{head}</thead>
              <tbody className="divide-y divide-slate-100">
                {sum.paidRecent.map((r) => {
                  const seg = r.segment_id ? segById.get(r.segment_id) : null;
                  return (
                    <tr key={r.id} className="align-top">
                      {invoiceCells(r)}
                      <td className="py-2.5 pr-3">
                        {seg ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Link href={`/trips/${seg.tripId}`} className="text-brand-600 hover:underline">№{carrierOrderNumber(seg)}</Link>
                            {canEdit && <UnlinkButton invoiceId={r.id} />}
                          </span>
                        ) : r.match_status === 'ignored' ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">{t('pay.notTrip')}{canEdit && <UnlinkButton invoiceId={r.id} />}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 text-right">{canEdit && <PurchasePaidButton invoiceId={r.id} paid />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </main>
  );
}
