'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { addManualPurchase, deleteManualPurchase } from '../../payables/actions';
import { confirmDialog, notify } from '../../components/Dialogs';

/** «Внести счёт» подрядчика к участку — для иностранцев (PDF по email) и всего, чего нет в KSeF. */
export function AddManualInvoice({ segmentId, currency, currencies }: { segmentId: string | null; currency: string; currencies: string[] }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary text-xs px-2.5 py-1.5">
        <Plus className="w-3.5 h-3.5" />
        {t('pay.add')}
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          fd.set('segment_id', segmentId ?? '');
          const r = await addManualPurchase(fd);
          if (!r.ok) setError(r.message ?? null);
          else {
            setOpen(false);
            router.refresh();
          }
        })
      }
    >
      <div className="text-sm font-semibold text-slate-800">{t('pay.addTitle')}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {!segmentId && (
          <>
            <label className="block col-span-2">
              <span className="block text-xs text-slate-600 mb-0.5">{t('payx5.fSeller')}</span>
              <input name="seller_name" required maxLength={200} className="input text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-0.5">{t('payx5.fNip')}</span>
              <input name="seller_nip" maxLength={30} className="input text-sm" />
            </label>
          </>
        )}
        <label className="block col-span-2 sm:col-span-1">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fNumber')}</span>
          <input name="invoice_number" required maxLength={100} className="input text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fDate')}</span>
          <input name="issue_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fDue')}</span>
          <input name="payment_due" type="date" className="input text-sm" title={t('pay.fDueHint')} />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fNet')}</span>
          <input name="net_amount" type="number" step="0.01" required className="input text-sm" title={t('pay.fNetHint')} />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fGross')}</span>
          <input name="gross_amount" type="number" step="0.01" className="input text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fCurrency')}</span>
          <select name="currency" defaultValue={currency} className="input text-sm">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block col-span-2 sm:col-span-3">
          <span className="block text-xs text-slate-600 mb-0.5">{t('pay.fFile')}</span>
          <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">{t('pay.fNetHint')} · {t('pay.fDueHint')}</p>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('pay.save')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary text-xs px-3 py-1.5">{t('pay.cancel')}</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}

export function DeleteManualInvoice({ invoiceId, number }: { invoiceId: string; number: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      title={t('pay.delete')}
      onClick={async () => {
        if (!(await confirmDialog(t('pay.deleteConfirm', { number }), { danger: true }))) return;
        start(async () => {
          const r = await deleteManualPurchase(invoiceId);
          if (!r.ok && r.message) notify(r.message, 'error');
          router.refresh();
        });
      }}
      className="text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}
