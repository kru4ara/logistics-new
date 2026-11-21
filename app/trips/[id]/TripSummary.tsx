import Link from 'next/link';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { formatDate } from '../../../lib/i18n/format';
import { isoCurrency } from '../../../lib/currency';

export type TripTab = 'overview' | 'route' | 'expenses' | 'docs' | 'money';
export const TRIP_TABS: TripTab[] = ['overview', 'route', 'expenses', 'docs', 'money'];
export const tripTabOf = (v: string | undefined): TripTab => (TRIP_TABS as string[]).includes(v ?? '') ? (v as TripTab) : 'overview';

/**
 * Сводка рейса без прокрутки: фрахт, расходы, прибыль, оплата клиента, документы.
 * Оплата — по поступлениям из выписки (если их видно), иначе по статусу и дате оплаты.
 */
export default async function TripSummary({
  tripId,
  revenue,
  expenses,
  profit,
  isForwarding,
  status,
  invoiceNumber,
  invoiceAmount,
  invoiceCurrency,
  paidAt,
  received,
  cmrCount,
  docsCount,
}: {
  tripId: string;
  revenue: number;
  expenses: number;
  profit: number;
  isForwarding: boolean;
  status: string;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  invoiceCurrency: string | null;
  paidAt: string | null;
  /** сумма поступлений из выписки в валюте счёта; null — не видно или нет данных */
  received: number | null;
  cmrCount: number;
  docsCount: number;
}) {
  const { t, locale } = await getT();
  const money = (n: number, cur: string | null = 'EUR') => {
    try {
      return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: isoCurrency(cur), maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(n)} ${cur ?? ''}`;
    }
  };
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const invoiced = ['invoiced', 'paid'].includes(status) && invoiceAmount != null;
  const paidPart = status === 'paid' ? invoiceAmount ?? 0 : received ?? 0;
  const pct = invoiced && invoiceAmount ? Math.max(0, Math.min(100, (paidPart / invoiceAmount) * 100)) : 0;
  const finished = ['completed', 'invoiced', 'paid'].includes(status);
  const tile = 'card p-4 flex flex-col gap-1 min-w-0';
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div className={tile}>
        <span className={label}>{t('trip.freight')}</span>
        <span className="text-xl md:text-2xl font-bold tabular-nums">{money(revenue)}</span>
        <span className="text-xs text-slate-500">{isForwarding ? t('tripTabs.forwarding') : t('tripTabs.ownTrip')}</span>
      </div>
      <div className={tile}>
        <span className={label}>{t('tripTabs.expenses')}</span>
        <span className="text-xl md:text-2xl font-bold tabular-nums text-red-600">{money(expenses)}</span>
        <Link href={`/trips/${tripId}?tab=expenses`} className="text-xs text-brand-700 hover:underline">{t('tripTabs.toExpenses')}</Link>
      </div>
      <div className={tile}>
        <span className={label}>{t('trips.profit')}</span>
        <span className={`text-xl md:text-2xl font-bold tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{money(profit)}</span>
        <span className="text-xs text-slate-500">{margin != null ? t('tripTabs.margin', { pct: margin.toFixed(1) }) : '—'}</span>
      </div>
      <Link href={`/trips/${tripId}?tab=money`} className={`${tile} hover:border-brand-200`}>
        <span className={label}>{t('tripTabs.clientPayment')}</span>
        {invoiced ? (
          <>
            <span className="text-xl md:text-2xl font-bold tabular-nums">
              {status === 'paid' ? t('tripTabs.paidFull') : `${Math.round(pct)} %`}
            </span>
            <span className="h-1.5 rounded-full bg-emerald-100 overflow-hidden" aria-hidden="true">
              <span className="block h-1.5 bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs text-slate-500 truncate">
              {status === 'paid' && paidAt ? `${formatDate(paidAt, locale)} · ` : ''}
              {invoiceNumber ?? ''} · {money(invoiceAmount ?? 0, invoiceCurrency)}
            </span>
          </>
        ) : (
          <>
            <span className="text-xl md:text-2xl font-bold text-slate-400">{t('tripTabs.noInvoice')}</span>
            <span className="text-xs text-slate-500">{finished ? t('tripTabs.issueHint') : t('tripTabs.afterTrip')}</span>
          </>
        )}
      </Link>
      <Link
        href={`/trips/${tripId}?tab=docs`}
        className={`${tile} col-span-2 lg:col-span-1 ${cmrCount === 0 && finished ? 'border-amber-300 bg-amber-50 hover:border-amber-400' : 'hover:border-brand-200'}`}
      >
        <span className={`${label} ${cmrCount === 0 && finished ? 'text-amber-800' : ''}`}>{t('tripTabs.docs')}</span>
        <span className={`text-xl md:text-2xl font-bold ${cmrCount === 0 && finished ? 'text-amber-800' : ''}`}>
          {cmrCount > 0 ? t('tripTabs.cmrOk') : t('tripTabs.cmrNone')}
        </span>
        <span className={`text-xs ${cmrCount === 0 && finished ? 'text-amber-800' : 'text-slate-500'}`}>{t('tripTabs.filesN', { n: docsCount })}</span>
      </Link>
    </div>
  );
}

/** Вкладки рейса — ссылками (?tab=): страница рисует только нужное, ссылку можно отправить. */
export async function TripTabsNav({ tripId, active, counts }: { tripId: string; active: TripTab; counts: Partial<Record<TripTab, number>> }) {
  const { t } = await getT();
  const labels: Record<TripTab, string> = {
    overview: t('tripTabs.overview'),
    route: t('tripTabs.route'),
    expenses: t('tripTabs.expenses'),
    docs: t('tripTabs.docs'),
    money: t('tripTabs.money'),
  };
  return (
    <nav aria-label={t('tripTabs.aria')} className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-4 px-4 md:mx-0 md:px-0">
      {TRIP_TABS.map((tab) => {
        const on = tab === active;
        const n = counts[tab];
        return (
          <Link
            key={tab}
            href={tab === 'overview' ? `/trips/${tripId}` : `/trips/${tripId}?tab=${tab}`}
            aria-current={on ? 'page' : undefined}
            scroll={false}
            className={`shrink-0 h-11 px-3 md:px-4 inline-flex items-center gap-2 text-sm md:text-[15px] border-b-2 -mb-px ${
              on ? 'border-brand-600 text-brand-800 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            {labels[tab]}
            {n != null && n > 0 && (
              <span className={`text-xs font-semibold rounded-full px-1.5 ${on ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
