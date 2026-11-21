import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { formatDate } from '../../../lib/i18n/format';
import { isoCurrency } from '../../../lib/currency';

/**
 * Поступления по счёту заказа из банковских выписок (payment_allocations): когда, сколько,
 * от кого и сколько осталось. Только для тех, кому видны выписки (bank.view).
 */
export default async function TripPayments({ tripId, invoiceAmount, invoiceCurrency }: { tripId: string; invoiceAmount: number | null; invoiceCurrency: string | null }) {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_allocations')
    .select('id, amount, currency, bank_transactions(id, booking_date, amount, currency, counterparty, title)')
    .eq('trip_id', tripId);
  // Не прочитали — блок не показываем, карточка рейса открывается.
  if (error) return null;
  const rows = ((data ?? []) as any[])
    .map((r) => {
      const tx = Array.isArray(r.bank_transactions) ? r.bank_transactions[0] : r.bank_transactions;
      return { id: r.id as string, amount: Number(r.amount), currency: String(r.currency), tx };
    })
    .filter((r) => r.tx)
    .sort((a, b) => String(a.tx.booking_date).localeCompare(String(b.tx.booking_date)));
  const money = (n: number, cur: string | null) => {
    try {
      return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: isoCurrency(cur) ?? 'EUR', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur ?? ''}`;
    }
  };
  const invCur = isoCurrency(invoiceCurrency) ?? 'EUR';
  const paid = rows.filter((r) => (isoCurrency(r.currency) ?? 'EUR') === invCur).reduce((s, r) => s + r.amount, 0);
  const left = invoiceAmount != null ? Math.round((invoiceAmount - paid) * 100) / 100 : null;

  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <Landmark className="w-4 h-4 text-brand-600" />
        {t('recv.payments')}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 mt-1">{t('recv.paymentsNone')}</p>
      ) : (
        <div className="mt-2 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="py-1.5 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 text-sm">
              <span className="text-slate-500 whitespace-nowrap w-24">{formatDate(r.tx.booking_date, locale)}</span>
              <span className="font-semibold text-emerald-700 whitespace-nowrap w-28">{money(r.amount, r.currency)}</span>
              <span className="flex-1 min-w-0 text-slate-600 truncate" title={r.tx.title ?? ''}>
                {r.tx.counterparty}
                {Number(r.tx.amount) !== r.amount && (
                  <span className="text-xs text-slate-400"> · {t('recv.ofPayment', { sum: money(Number(r.tx.amount), r.tx.currency) })}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {invoiceAmount != null && (
          <span className="text-slate-600">
            {t('recv.paidOf', { paid: money(paid, invCur), total: money(invoiceAmount, invCur) })}
          </span>
        )}
        {left != null && left > 0.5 && <span className="font-semibold text-amber-700">{t('recv.leftToPay', { sum: money(left, invCur) })}</span>}
        {left != null && left < -0.5 && <span className="font-semibold text-violet-700">{t('recv.overpaid', { sum: money(-left, invCur) })}</span>}
        <Link href="/bank?show=matched" className="text-xs text-brand-600 hover:underline">{t('pay2.toBank')}</Link>
      </div>
    </div>
  );
}
