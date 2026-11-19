'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Receipt, Loader2, Check } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { updateTripPayment } from '../../receivables/actions';

type Props = {
  tripId: string;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  paymentDue: string | null;
  paidAt: string | null;
  /** поступления из выписки (серверный блок) */
  children?: ReactNode;
};

/** Номер и даты счёта. Даты ставит триггер при смене статуса; здесь — ручная правка. */
export default function PaymentBlock({ tripId, invoiceNumber, invoicedAt, paymentDue, paidAt, children }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card p-5 md:p-6 space-y-4"
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await updateTripPayment(tripId, fd);
          if (res.ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } else setError(res.message ?? null);
        })
      }
    >
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-600" strokeWidth={2} />
          {t('recv.block')}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{t('recv.blockHint')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('recv.invoiceNo')}</span>
          <input name="invoice_number" defaultValue={invoiceNumber ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('recv.invoicedAt')}</span>
          <input type="date" name="invoiced_at" defaultValue={invoicedAt ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('recv.due')}</span>
          <input type="date" name="payment_due" defaultValue={paymentDue ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('recv.paidAt')}</span>
          <input type="date" name="paid_at" defaultValue={paidAt ?? ''} className="input" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn btn-secondary text-sm disabled:opacity-50">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-emerald-600" /> : null}
          {saved ? t('recv.saved') : t('common.save')}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      {children}
    </form>
  );
}
