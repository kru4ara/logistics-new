import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HandCoins, AlertTriangle, Clock, Inbox } from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { fetchAll } from '../../lib/fetch-all';
import { getSessionContext } from '../../lib/session';
import { can, deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import { INTL_LOCALE } from '../../lib/i18n/config';
import { formatDate } from '../../lib/i18n/format';
import type { MessageKey } from '../../lib/i18n/translate';
import { summarize, toReceivable, type Bucket, type Receivable, type ReceivableTrip } from '../../lib/receivables';
import MarkPaidButton from './MarkPaidButton';
import SyncInvoicesButton from './SyncInvoicesButton';
import RemindButton from './RemindButton';
import ToInvoiceSection from './ToInvoiceSection';
import UnmatchedInvoices, { type UnmatchedRow } from './UnmatchedInvoices';
import { readUnmatched } from '../../lib/invoicing/sync';
import { rankTripsForInvoice, type TripOption } from '../../lib/invoicing/sync-rules';
import { formatDateTime } from '../../lib/i18n/format';
import { getInvoiceProvider } from '../../lib/invoicing';
import { loadInvoicedTrips } from '../../lib/receivables-load';

export const dynamic = 'force-dynamic';

const BUCKETS: { id: Bucket; label: MessageKey; bar: string }[] = [
  { id: 'current', label: 'recv.bCurrent', bar: 'bg-slate-300' },
  { id: 'soon', label: 'recv.bSoon', bar: 'bg-amber-300' },
  { id: 'overdue', label: 'recv.bOverdue', bar: 'bg-orange-400' },
  { id: 'overdue30', label: 'recv.bOverdue30', bar: 'bg-red-500' },
  { id: 'overdue60', label: 'recv.bOverdue60', bar: 'bg-red-700' },
];

export default async function ReceivablesPage() {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'receivables.view');
  if (denied) redirect(denied);
  const canEdit = can(role, 'receivables.edit');
  const invoiceProvider = getInvoiceProvider();
  const { t, locale } = await getT();
  const eur = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const supabase = await createClient();
  const [{ data: trips, error }, { data: clients }] = await Promise.all([
    loadInvoicedTrips(supabase),
    fetchAll(supabase.from('clients').select('id, name, payment_days')),
  ]);
  if (error) return <div className="p-8 text-red-600">{t('trip.loadError', { msg: error.message })}</div>;

  // Последнее напоминание по клиенту (миграция 033; до неё таблицы нет — без подписи).
  const { data: reminders } = await supabase
    .from('client_reminders')
    .select('client_id, sent_at')
    .order('sent_at', { ascending: false })
    .limit(1000);
  const lastReminder = new Map<string, string>();
  for (const r of reminders ?? []) if (!lastReminder.has(r.client_id as string)) lastReminder.set(r.client_id as string, r.sent_at as string);

  const clientById = new Map((clients || []).map((c) => [c.id as string, c as { id: string; name: string; payment_days: number | null }]));
  const today = new Date().toISOString().slice(0, 10);
  const items = ((trips || []) as ReceivableTrip[]).map((tr) =>
    toReceivable(tr, tr.client_id ? clientById.get(tr.client_id)?.payment_days : null, today),
  );
  const s = summarize(items);

  // Фактуры сервиса без заказа (из последней сверки) — с подсказками заказов.
  const unmatched = invoiceProvider?.listInvoices ? await readUnmatched(supabase).catch(() => null) : null;
  let unmatchedRows: UnmatchedRow[] = [];
  if (unmatched?.items.length) {
    const { data: freeTrips } = await fetchAll(
      supabase
        .from('trips')
        .select('id, trip_number, revenue_eur, start_date, end_date, status, clients(name, tax_id)')
        .is('invoice_external_id', null)
        .in('status', ['active', 'completed', 'invoiced', 'paid']),
    );
    const opts: (TripOption & { client: string | null })[] = ((freeTrips ?? []) as any[]).map((tr) => {
      const c = Array.isArray(tr.clients) ? tr.clients[0] : tr.clients;
      return {
        id: tr.id,
        trip_number: tr.trip_number,
        client_tax_id: c?.tax_id ?? null,
        client: c?.name ?? null,
        revenue_eur: tr.revenue_eur != null ? Number(tr.revenue_eur) : null,
        date: String(tr.end_date ?? tr.start_date ?? '').slice(0, 10) || null,
      };
    });
    const money = (n: number | null, cur: string | null) =>
      n == null ? '—' : new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(n);
    unmatchedRows = unmatched.items.map((r) => {
      const ranked = rankTripsForInvoice(r, opts).slice(0, 40) as (TripOption & { client: string | null; score: number })[];
      return {
        externalId: r.externalId,
        number: r.number ?? r.externalId,
        issueDate: r.issueDate ? formatDate(r.issueDate, locale) : '—',
        amount: money(r.gross, r.currency),
        buyer: r.buyerName ?? '—',
        options: ranked.map((o) => ({
          id: o.id,
          suggested: o.score >= 50,
          label: [`№${o.trip_number ?? '—'}`, o.client, o.revenue_eur != null ? eur(o.revenue_eur) : null, o.date ? formatDate(o.date, locale) : null]
            .filter(Boolean)
            .join(' · '),
        })),
      };
    });
  }

  const dueLabel = (r: Receivable) => {
    if (r.daysOverdue === null) return t('recv.noDue');
    if (r.daysOverdue > 0) return t('recv.daysOverdue', { n: r.daysOverdue });
    if (r.daysOverdue === 0) return t('recv.dueToday');
    return t('recv.daysLeft', { n: -r.daysOverdue });
  };
  const dueClass = (r: Receivable) =>
    r.daysOverdue === null
      ? 'text-slate-400'
      : r.daysOverdue > 30
        ? 'text-red-700 font-semibold'
        : r.daysOverdue > 0
          ? 'text-orange-600 font-semibold'
          : r.daysOverdue >= -7
            ? 'text-amber-600'
            : 'text-slate-500';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <HandCoins className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('recv.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">{t('recv.hint')}</p>
        </div>
        {canEdit && invoiceProvider?.listInvoices && <SyncInvoicesButton provider={invoiceProvider.name} />}
        </div>

        <ToInvoiceSection
          supabase={supabase}
          clientName={(id) => (id ? clientById.get(id)?.name ?? '—' : '—')}
          t={t}
          locale={locale}
          eur={eur}
        />

        {unmatched && (
          <UnmatchedInvoices rows={unmatchedRows} canEdit={canEdit} provider={invoiceProvider?.name ?? ''} at={formatDateTime(unmatched.at, locale)} />
        )}

        {s.count === 0 ? (
          <div className="card p-10 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" strokeWidth={1.8} />
            <div className="font-semibold text-slate-700">{t('recv.empty')}</div>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{t('recv.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="text-xs text-slate-500">{t('recv.total')}</div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">{eur(s.total)}</div>
                <div className="text-xs text-slate-400">{t('recv.invoices', { n: s.count })}</div>
              </div>
              <div className={`card p-4 ${s.overdue > 0 ? 'border-red-200 bg-red-50/40' : ''}`}>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> {t('recv.overdue')}
                </div>
                <div className="text-2xl font-bold text-red-700 tabular-nums">{eur(s.overdue)}</div>
                <div className="text-xs text-slate-400">{t('recv.invoices', { n: s.overdueCount })}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> {t('recv.soon')}
                </div>
                <div className="text-2xl font-bold text-amber-700 tabular-nums">{eur(s.soon)}</div>
              </div>
            </div>

            {/* Давность долга: одна полоса, доли по сумме */}
            <div className="card p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-700">{t('recv.aging')}</div>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {BUCKETS.map((b) =>
                  s.byBucket[b.id] > 0 ? (
                    <div key={b.id} className={b.bar} style={{ width: `${(s.byBucket[b.id] / s.total) * 100}%` }} title={t(b.label)} />
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {BUCKETS.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${b.bar}`} />
                    {t(b.label)}: <b className="tabular-nums">{eur(s.byBucket[b.id])}</b>
                  </span>
                ))}
              </div>
            </div>

            {s.clients.map((g) => {
              const client = g.clientId ? clientById.get(g.clientId) : null;
              return (
                <div key={g.clientId ?? 'none'} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-baseline justify-between gap-2">
                    {client ? (
                      <Link href={`/clients/${client.id}`} className="font-bold text-slate-900 hover:text-brand-700">
                        {client.name}
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-500">{t('recv.noClient')}</span>
                    )}
                    <div className="text-sm tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        <b className="text-slate-900">{eur(g.total)}</b>
                        {g.overdue > 0 && (
                          <span className="text-red-700 ml-2">· {t('recv.clientOverdue', { amount: eur(g.overdue) })}</span>
                        )}
                      </span>
                      {canEdit && client && g.overdue > 0 && (
                        <RemindButton
                          clientId={client.id}
                          clientName={client.name}
                          lastSent={lastReminder.has(client.id) ? formatDate(lastReminder.get(client.id) as string, locale) : null}
                        />
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500 bg-slate-50/70">
                        <tr>
                          <th className="text-left font-medium px-4 py-2">{t('recv.trip')}</th>
                          <th className="text-left font-medium px-4 py-2">{t('recv.invoice')}</th>
                          <th className="text-right font-medium px-4 py-2">{t('recv.amount')}</th>
                          <th className="text-left font-medium px-4 py-2">{t('recv.due')}</th>
                          <th className="text-left font-medium px-4 py-2">{t('recv.status')}</th>
                          {canEdit && <th className="px-4 py-2" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {g.items.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-2.5">
                              <Link href={`/trips/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                                №{r.trip_number || '—'}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{r.invoice_number || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                              {eur(r.amount)}
                              {r.amountDiff != null && (
                                <div className="text-[11px] font-normal text-amber-600" title={t('recv.amountDiffHint')}>
                                  {t('recv.freight', { amount: eur(Number(r.revenue_eur) || 0) })}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums" title={r.estimated ? t('recv.estimated') : undefined}>
                              {r.due ? `${r.estimated ? '≈ ' : ''}${formatDate(r.due, locale)}` : '—'}
                            </td>
                            <td className={`px-4 py-2.5 ${dueClass(r)}`}>{dueLabel(r)}</td>
                            {canEdit && (
                              <td className="px-4 py-2.5 text-right">
                                <MarkPaidButton tripId={r.id} tripNumber={r.trip_number || '—'} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {items.some((r) => r.estimated) && <p className="text-xs text-slate-400">≈ — {t('recv.estimated')}</p>}
          </>
        )}
      </div>
    </main>
  );
}
