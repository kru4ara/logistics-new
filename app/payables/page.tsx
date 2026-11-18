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
import { AddManualInvoice } from '../trips/[id]/ContractorInvoicesForms';
import { MANUAL_CURRENCIES } from '../../lib/payables/cost-rules';
import { SyncPurchasesButton, TripDoubleActions, LinkPurchaseForm, UnlinkButton, PurchasePaidButton, PaidDateInput, DeleteManualButton, type PickOption, type CategoryOption } from './PayablesControls';
import { loadTripCandidates, lastTripCategoryByNip, loadInvoiceTrips } from '../../lib/payables/trip-expense';
import { suggestTrips, defaultTripCategory, tripsForPeriodInvoice, findManualOverlaps, NOT_DOUBLE_KEY, type TripCandidate, type ManualExpense } from '../../lib/payables/trip-rules';
import { fetchAllByIds } from '../../lib/fetch-all';
import { costAmount } from '../../lib/payables/cost-rules';
import { EXPENSE_CATEGORIES, expenseCategoryKey } from '../../lib/i18n/labels';
import type { MessageKey } from '../../lib/i18n/translate';
import { findDuplicateGroups } from '../../lib/payables/duplicate-rules';
import { groupBySeller, guessSeller, OVERHEAD_CATEGORIES } from '../../lib/payables/overhead-rules';
import { SellerSortForm, InvoiceOverheadSelect } from './SortControls';

export const dynamic = 'force-dynamic';

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = String((await searchParams).q ?? '').trim().slice(0, 100);
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
  const COLS = 'id, ksef_number, source, invoice_number, issue_date, seller_nip, seller_name, net_amount, gross_amount, currency, payment_due, description, segment_id, match_status, paid_at';
  const load = (cols: string) =>
    fetchAll(supabase.from('purchase_invoices').select(cols).order('issue_date', { ascending: false }).order('id'));
  let { data, error } = await load(`${COLS}, trip_id, overhead_category`);
  // Между деплоем и миграциями 037/038 новых колонок ещё нет.
  if (error && /overhead_category/.test(error.message)) ({ data, error } = await load(`${COLS}, trip_id`));
  if (error && /trip_id/.test(error.message)) ({ data, error } = await load(COLS));
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
  // Поиск по всем счетам, не только за 60 дней: номер или продавец (F/0020 → «F0020»).
  const norm = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9А-ЯЁĄĆĘŁŃÓŚŹŻ]/g, '');
  const nq = norm(q);
  const found = nq.length >= 2 ? rows.filter((r) => norm(r.invoice_number).includes(nq) || norm(r.seller_name).includes(nq)).slice(0, 100) : [];
  const duplicates = findDuplicateGroups(rows);
  const sellerGroups = groupBySeller(rows.filter((r) => r.match_status === 'ignored'));
  const toSort = sellerGroups.filter((g) => g.uncategorized > 0);
  const sorted = sellerGroups.filter((g) => g.uncategorized === 0);

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

  // Участки с уже привязанным счётом тоже доступны: доплата, korekta. Список — один на страницу.
  const segmentOptions: PickOption[] = segments.map((s) => ({ id: s.id, label: segLabel(s) }));
  const suggestedSegmentIds = (r: PayableRow) =>
    suggestSegments(
      { sellerNip: r.seller_nip, invoiceNumber: r.invoice_number, issueDate: r.issue_date, net: r.net_amount, gross: r.gross_amount, currency: r.currency, description: r.description },
      segments,
    ).slice(0, 5).map((x) => x.segmentId);

  // Рейсы — для счетов-расходов рейса (перегруз, EX-1, EPI): подсказка по датам рейса.
  // Уже привязанные счета, которые повторяют ручную запись в том же рейсе (внесли до KSeF).
  const { data: invExp } = await fetchAll(
    supabase.from('trip_expenses').select('id, trip_id, category, original_amount, currency, purchase_invoice_id').not('purchase_invoice_id', 'is', null).order('id'),
  );
  const invExpRows = (invExp ?? []) as { id: string; trip_id: string; category: string | null; original_amount: number | null; currency: string | null; purchase_invoice_id: string }[];
  const { data: manExp } = invExpRows.length
    ? await fetchAllByIds([...new Set(invExpRows.map((r) => r.trip_id))], (chunk) =>
        supabase.from('trip_expenses').select('id, trip_id, category, description, original_amount, currency').in('trip_id', chunk).is('purchase_invoice_id', null),
      )
    : { data: [] as any[] };
  const manualRows = (manExp ?? []) as (ManualExpense & { original_amount: number | null; currency: string | null })[];
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const tripDoubles: { key: string; tripId: string; manual: (typeof manualRows)[number]; share: (typeof invExpRows)[number]; invoice: string }[] = [];
  const { data: notDouble } = await supabase.from('integration_state').select('value').eq('key', NOT_DOUBLE_KEY).maybeSingle();
  const seenManual = new Set<string>();
  try {
    for (const id of JSON.parse(notDouble?.value ?? '[]') as string[]) seenManual.add(id);
  } catch {
    /* повреждённый список — показываем всё */
  }
  for (const e of invExpRows) {
    const inv = rowById.get(e.purchase_invoice_id);
    if (!inv || !e.category) continue;
    for (const m of findManualOverlaps(manualRows, [e.trip_id], e.category, inv.seller_name, inv.invoice_number)) {
      if (seenManual.has(m.id)) continue;
      seenManual.add(m.id);
      const full = manualRows.find((x) => x.id === m.id)!;
      tripDoubles.push({ key: m.id, tripId: e.trip_id, manual: full, share: e, invoice: [inv.seller_name, inv.invoice_number].filter(Boolean).join(' · ') });
    }
  }

  const invoiceTrips = await loadInvoiceTrips(supabase, rows.filter((r) => r.trip_id).map((r) => r.id));
  const linkedTripIds = [
    ...new Set([...rows.map((r) => r.trip_id).filter((x): x is string => Boolean(x)), ...[...invoiceTrips.values()].flat()]),
  ];
  const trips: TripCandidate[] = sum.unmatched.length || linkedTripIds.length ? await loadTripCandidates(supabase, linkedTripIds) : [];
  const tripById = new Map(trips.map((x) => [x.id, x]));
  const tripLabel = (x: TripCandidate) =>
    [
      `№${x.number ?? '?'}`,
      x.clientName,
      x.truck,
      x.start ? `${formatDate(x.start, locale)}${x.end && x.end !== x.start ? `–${formatDate(x.end, locale)}` : ''}` : null,
    ].filter(Boolean).join(' · ');
  const tripOptions: PickOption[] = trips.map((x) => ({ id: x.id, label: tripLabel(x) }));
  const lastByNip = sum.unmatched.length ? await lastTripCategoryByNip(supabase) : new Map<string, string>();
  const categoryOptions: CategoryOption[] = EXPENSE_CATEGORIES.map((c) => ({
    value: c.value,
    label: `${c.emoji} ${t(expenseCategoryKey(c.value) as MessageKey)}`,
  }));
  const ohOptions: CategoryOption[] = OVERHEAD_CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${t(`ohCat.${c.value}` as MessageKey)}` }));
  const ohLabel = (cat: string | null | undefined) => ohOptions.find((o) => o.value === cat)?.label ?? null;
  const tripCell = (r: PayableRow) => {
    const x = r.trip_id ? tripById.get(r.trip_id) : null;
    if (!r.trip_id) return null;
    const shares = invoiceTrips.get(r.id) ?? [];
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Link href={`/trips/${r.trip_id}`} className="text-brand-600 hover:underline">{t('payx2.tripRef', { n: x?.number ?? '?' })}</Link>
        {shares.length > 1 && (
          <span className="text-xs text-slate-500" title={shares.map((id) => tripById.get(id)?.number ?? '?').join(', ')}>
            {t('payx4.plusTrips', { n: shares.length - 1 })}
          </span>
        )}
        <span className="text-[10px] uppercase text-slate-400">{t('payx2.asExpense')}</span>
        {canEdit && <UnlinkButton invoiceId={r.id} />}
      </span>
    );
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
          <div className="flex flex-col items-start md:items-end gap-2">
            {canEdit && isKsefConfigured() && <SyncPurchasesButton />}
            <Link href="/payables/agency" className="text-sm font-semibold text-brand-700 hover:underline">{t('agency.open')} →</Link>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-col gap-1">
            <AddManualInvoice segmentId={null} currency="EUR" currencies={MANUAL_CURRENCIES} />
            <p className="text-xs text-slate-500">{t('payx5.addStandaloneHint')}</p>
          </div>
        )}

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

        {tripDoubles.length > 0 && (
          <section className="card p-4 md:p-5 border-amber-300 bg-amber-50/40">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Copy className="w-4 h-4 text-amber-600" />{t('payx5.tripDupTitle', { n: tripDoubles.length })}</h2>
            <p className="text-sm text-slate-600 mt-1 mb-3">{t('payx5.tripDupHint')}</p>
            <div className="divide-y divide-amber-100">
              {tripDoubles.map((d) => (
                <div key={d.key} className="py-2 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm">
                  <Link href={`/trips/${d.tripId}`} className="font-semibold text-brand-700 hover:underline whitespace-nowrap">
                    №{tripById.get(d.tripId)?.number ?? '—'}
                  </Link>
                  <div className="flex-1 min-w-0 text-slate-700 break-words">
                    {t('payx5.manualRow')}: {d.manual.description || d.manual.category} · {money(d.manual.original_amount, d.manual.currency)}
                  </div>
                  <div className="flex-1 min-w-0 text-slate-500 break-words">
                    {t('payx5.invoiceRow')}: {d.invoice} · {money(d.share.original_amount, d.share.currency)}
                  </div>
                  {canEdit && <TripDoubleActions manualId={d.manual.id} />}
                </div>
              ))}
            </div>
          </section>
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
                      {canEdit ? (
                        <LinkPurchaseForm
                          invoiceId={r.id}
                          segments={segmentOptions}
                          suggestedSegments={suggestedSegmentIds(r)}
                          trips={tripOptions}
                          suggestedTrips={suggestTrips(r.issue_date, trips).map((x) => x.id)}
                          periodTrips={tripsForPeriodInvoice(r.issue_date, trips).map((x) => x.id)}
                          total={costAmount({ net: r.net_amount, gross: r.gross_amount }) ?? 0}
                          currency={r.currency || 'PLN'}
                          categories={categoryOptions}
                          defaultCategory={defaultTripCategory({ nip: r.seller_nip, name: r.seller_name }, lastByNip)}
                        />
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

{sellerGroups.length > 0 && (
          // Всё разобрано — список свёрнут: нужен, только чтобы поменять категорию продавца.
          <details id="sort" open={toSort.length > 0} className="card p-4 md:p-5 overflow-x-auto group">
            <summary className="cursor-pointer list-none">
              <h2 className="font-bold text-slate-900 inline">
                {toSort.length > 0 ? t('payx3.secSort', { n: toSort.length }) : t('payx5.sortDone', { n: sellerGroups.length })}
              </h2>
              <span className="ml-2 text-xs text-brand-600 group-open:hidden">{t('payx5.show')}</span>
            </summary>
            <p className="text-sm text-slate-500 mt-1 mb-3">{t('payx3.sortHint')}</p>
            {[...toSort, ...sorted].map((g, gi) => {
              const guess = guessSeller(g.name);
              const open = gi < 3 && g.uncategorized > 0;
              return (
                <details key={g.key} open={open} className={`border-t border-slate-100 py-2 ${g.uncategorized ? '' : 'opacity-80'}`}>
                  <summary className="cursor-pointer flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-slate-900">{g.name}</span>
                    <span className="text-xs text-slate-400">{g.nip}</span>
                    <span className="text-xs text-slate-500">{t('payx3.invoices', { n: g.rows.length })} · {g.totals.map((x) => money(x.amount, x.currency)).join(' · ')}</span>
                    {g.uncategorized > 0
                      ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t('payx3.unsorted', { n: g.uncategorized })}</span>
                      : g.category && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{ohLabel(g.category)}</span>}
                  </summary>
                  <div className="pl-2 md:pl-4 pt-2 space-y-2">
                    {canEdit && (
                      <SellerSortForm
                        sellerKey={g.key}
                        count={g.rows.length}
                        categories={ohOptions}
                        initial={guess?.assignment === 'trip' ? 'trip' : guess?.assignment === 'overhead' ? guess.category : g.category ?? ''}
                        guessed={Boolean(guess)}
                      />
                    )}
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-50">
                        {g.rows.map((r) => (
                          <tr key={r.id}>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{r.invoice_number ?? '—'}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{r.issue_date ? formatDate(r.issue_date, locale) : ''}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">{money(r.gross_amount, r.currency)}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{r.paid_at ? t('pay.paidOn', { date: formatDate(r.paid_at, locale) }) : ''}</td>
                            <td className="py-1.5 text-right">
                              {canEdit
                                ? <InvoiceOverheadSelect invoiceId={r.id} value={r.overhead_category ?? ''} categories={ohOptions} />
                                : ohLabel(r.overhead_category) ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </details>
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
                        {r.trip_id ? tripCell(r) : seg ? (
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

        <section className="card p-4 md:p-5 overflow-x-auto" id="find">
          <form method="get" action="/payables#find" className="flex flex-wrap items-center gap-2">
            <input name="q" defaultValue={q} placeholder={t('payx5.findPlaceholder')} className="input text-sm flex-1 min-w-[14rem]" />
            <button type="submit" className="btn btn-secondary text-sm">{t('payx5.find')}</button>
            {q && <Link href="/payables" className="text-sm text-slate-500 hover:underline">{t('payx5.findReset')}</Link>}
          </form>
          <p className="text-xs text-slate-500 mt-1">{t('payx5.findHint')}</p>
          {q && (
            found.length === 0 ? (
              <p className="text-sm text-slate-500 mt-3">{t('payx5.findNone')}</p>
            ) : (
              <table className="w-full text-sm mt-3">
                <thead>{head}</thead>
                <tbody className="divide-y divide-slate-100">
                  {found.map((r) => {
                    const seg = r.segment_id ? segById.get(r.segment_id) : null;
                    return (
                      <tr key={r.id} className="align-top">
                        {invoiceCells(r)}
                        <td className="py-2.5 pr-3">
                          {r.trip_id ? tripCell(r) : seg ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Link href={`/trips/${seg.tripId}`} className="text-brand-600 hover:underline">№{carrierOrderNumber(seg)}</Link>
                              {canEdit && <UnlinkButton invoiceId={r.id} />}
                            </span>
                          ) : r.match_status === 'ignored' ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-400">{t('pay.notTrip')}{canEdit && <UnlinkButton invoiceId={r.id} />}</span>
                          ) : t('payx5.findUnlinked')}
                        </td>
                        <td className="py-2.5 text-right">{canEdit && <PurchasePaidButton invoiceId={r.id} paid={Boolean(r.paid_at)} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </section>

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
                        {r.trip_id ? tripCell(r) : seg ? (
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
