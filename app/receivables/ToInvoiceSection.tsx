import Link from 'next/link';
import { FileCheck2, FileWarning, ArrowRight } from 'lucide-react';
import type { createClient } from '../../lib/supabase/admin';
import { fetchAll, fetchAllByIds } from '../../lib/fetch-all';
import { buildToInvoice, firstCmrByTrip, NOT_INVOICED_STATUSES, type ToInvoiceTrip } from '../../lib/to-invoice';
import { formatDate } from '../../lib/i18n/format';
import type { Locale } from '../../lib/i18n/config';
import type { T } from '../../lib/i18n/translate';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** «К выставлению»: заказы с CMR без счёта и завершённые без CMR. */
export default async function ToInvoiceSection({
  supabase,
  clientName,
  t,
  locale,
  eur,
}: {
  supabase: Supabase;
  clientName: (id: string | null) => string;
  t: T;
  locale: Locale;
  eur: (n: number) => string;
}) {
  const { data: trips, error } = await fetchAll(
    supabase
      .from('trips')
      .select('id, trip_number, client_id, status, end_date, revenue_eur')
      .in('status', [...NOT_INVOICED_STATUSES]),
  );
  if (error || !trips) return null;
  const { data: docs } = await fetchAllByIds(
    (trips as ToInvoiceTrip[]).map((tr) => tr.id),
    (chunk) => supabase.from('trip_documents').select('trip_id, uploaded_at').eq('document_type', 'cmr').in('trip_id', chunk),
  );
  const today = new Date().toISOString().slice(0, 10);
  const list = buildToInvoice(trips as ToInvoiceTrip[], firstCmrByTrip(docs ?? []), today);

  return (
    <div className="card p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
          {t('toinv.title')}
          {list.ready.length > 0 && (
            <span className="text-sm font-semibold text-emerald-700 tabular-nums">
              · {t('toinv.readyTotal', { n: list.ready.length, amount: eur(list.readyTotal) })}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500">{t('toinv.hint')}</p>
      </div>

      {list.ready.length === 0 ? (
        <div className="text-sm text-slate-500">{t('toinv.none')}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {list.ready.map((r) => (
            <div key={r.id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href={`/trips/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 min-w-[4rem]">
                №{r.trip_number ?? '—'}
              </Link>
              <span className="text-sm text-slate-700 flex-1 min-w-[10rem]">{clientName(r.client_id)}</span>
              <span className="text-xs text-slate-500">
                {r.cmrCount > 1
                  ? t('toinv.cmrMany', { date: formatDate(r.cmrAt, locale), n: r.cmrCount })
                  : t('toinv.cmrAt', { date: formatDate(r.cmrAt, locale) })}
                {r.status === 'active' && <span className="ml-1 text-amber-700">· {t('toinv.inTransit')}</span>}
              </span>
              <span className={`text-xs tabular-nums ${(r.waitingDays ?? 0) > 3 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                {t('toinv.waiting', { n: r.waitingDays ?? 0 })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900 w-24 text-right">
                {r.revenue_eur != null ? eur(Number(r.revenue_eur)) : '—'}
              </span>
              <Link
                href={`/trips/${r.id}#invoice`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 whitespace-nowrap"
              >
                {t('toinv.issue')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {list.noCmr.length > 0 && (
        <details className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-800 flex items-center gap-2">
            <FileWarning className="w-4 h-4" strokeWidth={2.2} />
            {t('toinv.noCmrTitle', { n: list.noCmr.length })}
          </summary>
          <p className="text-xs text-amber-800/80 mt-2">{t('toinv.noCmrHint')}</p>
          <div className="mt-2 divide-y divide-amber-100">
            {list.noCmr.map((r) => (
              <div key={r.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Link href={`/trips/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700 min-w-[4rem]">
                  №{r.trip_number ?? '—'}
                </Link>
                <span className="text-slate-700 flex-1 min-w-[10rem]">{clientName(r.client_id)}</span>
                {r.waitingDays != null && <span className="text-xs text-slate-500">{t('toinv.afterEnd', { n: r.waitingDays })}</span>}
                <span className="font-semibold tabular-nums w-24 text-right">{r.revenue_eur != null ? eur(Number(r.revenue_eur)) : '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
