import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardCheck, ArrowLeft } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import { getSessionContext } from '../../../lib/session';
import { can, deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { formatDate } from '../../../lib/i18n/format';
import { expenseCategoryKey } from '../../../lib/i18n/labels';
import { inspectAgencyExpenses, agencySummary, AGENCY_CATEGORIES, type AgencyExpense, type AgencyIssue } from '../../../lib/payables/agency-check';
import { NOT_DOUBLE_KEY } from '../../../lib/payables/trip-rules';
import { TripDoubleActions } from '../PayablesControls';

export const dynamic = 'force-dynamic';

const SHOWS = ['problems', 'double', 'noInvoice', 'multi', 'all'] as const;
type Show = (typeof SHOWS)[number];

/** Проверка EPI / EX-1 по рейсам: ручные записи против счетов агентств — без задвоений и пропусков. */
export default async function AgencyCheckPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'payables.view');
  if (denied) redirect(denied);
  const canEdit = can(role, 'payables.edit');
  const { t, locale } = await getT();
  const sp = await searchParams;
  const show: Show = (SHOWS as readonly string[]).includes(sp.show ?? '') ? (sp.show as Show) : 'problems';
  const supabase = await createClient();

  const { data: exp } = await fetchAll(
    supabase
      .from('trip_expenses')
      .select('id, trip_id, category, description, original_amount, currency, amount_eur, purchase_invoice_id, paid_by_driver')
      .in('category', [...AGENCY_CATEGORIES])
      .order('id'),
  );
  const expenses = (exp ?? []) as AgencyExpense[];
  const { data: nd } = await supabase.from('integration_state').select('value').eq('key', NOT_DOUBLE_KEY).maybeSingle();
  let checked = new Set<string>();
  try {
    checked = new Set(JSON.parse(nd?.value ?? '[]') as string[]);
  } catch {
    /* повреждённый список — проверяем всё */
  }
  const tripIds = [...new Set(expenses.map((r) => r.trip_id))];
  const { data: trips } = await fetchAllByIds(tripIds, (chunk) =>
    supabase.from('trips').select('id, trip_number, client_request_number, start_date, end_date, clients(name)').in('id', chunk),
  );
  const tripById = new Map(((trips ?? []) as any[]).map((x) => [x.id as string, x]));
  const tripStart = new Map(((trips ?? []) as any[]).map((x) => [x.id as string, x.start_date ? String(x.start_date).slice(0, 10) : null]));
  const rows = inspectAgencyExpenses(expenses, checked, tripStart);
  const sum = agencySummary(rows);
  const invIds = [...new Set(expenses.map((e) => e.purchase_invoice_id).filter((x): x is string => Boolean(x)))];
  const { data: invs } = await fetchAllByIds(invIds, (chunk) =>
    supabase.from('purchase_invoices').select('id, invoice_number, seller_name').in('id', chunk),
  );
  const invById = new Map(((invs ?? []) as any[]).map((x) => [x.id as string, x]));

  const visible = rows.filter((r) => (show === 'all' ? true : show === 'problems' ? r.issue !== 'ok' : r.issue === show));
  const money = (n: number | null, cur: string | null) =>
    n == null ? '—' : new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(n);
  const catLabel = (c: string) => {
    const k = expenseCategoryKey(c);
    return k ? t(k) : c;
  };
  const issueStyle: Record<AgencyIssue, string> = {
    double: 'bg-red-50 text-red-700',
    noInvoice: 'bg-amber-50 text-amber-800',
    multi: 'bg-violet-50 text-violet-700',
    ok: 'bg-emerald-50 text-emerald-700',
  };
  const chip = (key: Show, label: string, n: number) => (
    <Link
      key={key}
      href={`/payables/agency?show=${key}`}
      className={`px-3 py-1.5 rounded-lg text-sm border ${show === key ? 'bg-brand-50 border-brand-300 text-brand-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
    >
      {label} ({n})
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div>
          <Link href="/payables" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> {t('pay.title')}
          </Link>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <ClipboardCheck className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('agency.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base max-w-3xl">{t('agency.hint')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {chip('problems', t('agency.problems'), sum.double + sum.noInvoice + sum.multi)}
          {chip('double', t('agency.double'), sum.double)}
          {chip('noInvoice', t('agency.noInvoice'), sum.noInvoice)}
          {chip('multi', t('agency.multi'), sum.multi)}
          {chip('all', t('agency.all'), rows.length)}
        </div>

        <div className="card p-4 text-xs text-slate-600 space-y-1">
          <div><span className={`px-1.5 py-0.5 rounded font-semibold ${issueStyle.double}`}>{t('agency.double')}</span> — {t('agency.doubleHint')}</div>
          <div><span className={`px-1.5 py-0.5 rounded font-semibold ${issueStyle.noInvoice}`}>{t('agency.noInvoice')}</span> — {t('agency.noInvoiceHint')}</div>
          <div><span className={`px-1.5 py-0.5 rounded font-semibold ${issueStyle.multi}`}>{t('agency.multi')}</span> — {t('agency.multiHint')}</div>
        </div>

        {visible.length === 0 ? (
          <div className="card p-10 text-center text-slate-600 font-semibold">{t('agency.empty')}</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {visible.map((r) => {
              const tr = tripById.get(r.tripId);
              const client = tr ? (Array.isArray(tr.clients) ? tr.clients[0] : tr.clients)?.name : null;
              return (
                <div key={`${r.tripId}|${r.category}`} className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-[13rem_1fr_1fr] gap-2 md:gap-4 text-sm">
                  <div>
                    <Link href={`/trips/${r.tripId}`} className="font-semibold text-brand-700 hover:underline">
                      №{tr?.client_request_number || tr?.trip_number || '—'}
                    </Link>
                    <div className="text-xs text-slate-500 truncate">{client ?? '—'}</div>
                    <div className="text-xs text-slate-400">
                      {tr?.start_date ? formatDate(tr.start_date, locale) : '—'} – {tr?.end_date ? formatDate(tr.end_date, locale) : '—'}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{catLabel(r.category)}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${issueStyle[r.issue]}`}>{t(`agency.${r.issue}`)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">{t('payx5.manualRow')} · {money(r.manualEur, 'EUR')}</div>
                    {r.manual.length === 0 ? (
                      <div className="text-xs text-slate-400">—</div>
                    ) : (
                      r.manual.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                          <span className="text-slate-700">
                            {m.description || catLabel(r.category)} · {money(m.original_amount, m.currency)}
                            {m.paid_by_driver && <span className="ml-1 text-[10px] text-slate-500">({t('agency.byDriver')})</span>}
                            {checked.has(m.id) && <span className="ml-1 text-[10px] text-emerald-700">({t('agency.checked')})</span>}
                          </span>
                          {canEdit && r.issue !== 'ok' && !checked.has(m.id) && <TripDoubleActions manualId={m.id} />}
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">{t('payx5.invoiceRow')} · {money(r.invoiceEur, 'EUR')}</div>
                    {r.fromInvoice.length === 0 ? (
                      <div className="text-xs text-slate-400">—</div>
                    ) : (
                      r.fromInvoice.map((x) => {
                        const inv = invById.get(x.purchase_invoice_id ?? '');
                        return (
                          <div key={x.id} className="text-slate-700 py-0.5 break-words">
                            {[inv?.seller_name, inv?.invoice_number].filter(Boolean).join(' · ') || '—'} · {money(x.original_amount, x.currency)}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
