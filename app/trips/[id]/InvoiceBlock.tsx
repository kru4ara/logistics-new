'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { FileText, Loader2, RefreshCw, Send, Download, AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { issueInvoice, refreshInvoice, resendInvoiceToKsef } from '../../invoices/actions';
import { TAX_RATES, type TaxRate, type NpKind } from '../../../lib/invoice-rules';
import { ksefStateOf, type KsefState, type ProviderInfo } from '../../../lib/invoicing/types';
import type { MessageKey } from '../../../lib/i18n/translate';

type Issued = {
  invoiceNumber: string | null;
  ksefStatus: string | null;
  ksefNumber: string | null;
  ksefError: string | null;
};

type Defaults = {
  issueDate: string;
  sellDate: string;
  paymentDays: number;
  netAmount: number | null;
  tax: TaxRate;
  npKind: NpKind | null;
  reverseCharge: boolean;
  lang: string;
  positionName: string;
};

type Props = {
  tripId: string;
  /** сервис фактур компании (или тот, которым выставлена фактура); null — не подключён */
  provider: ProviderInfo | null;
  issued: Issued | null;
  defaults: Defaults;
  clientId: string | null;
  clientName: string | null;
  /** чего не хватает в карточке клиента для фактуры */
  clientMissing: MessageKey[];
};

const STATE_UI: Record<KsefState, { label: MessageKey; cls: string; Icon: typeof Clock }> = {
  none: { label: 'inv.ksefNone', cls: 'bg-slate-100 text-slate-600', Icon: Clock },
  pending: { label: 'inv.ksefPending', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  processing: { label: 'inv.ksefProcessing', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  ok: { label: 'inv.ksefOk', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  error: { label: 'inv.ksefError', cls: 'bg-red-50 text-red-700', Icon: AlertTriangle },
  notConnected: { label: 'inv.ksefNotConnected', cls: 'bg-red-50 text-red-700', Icon: AlertTriangle },
  notApplicable: { label: 'inv.ksefNotApplicable', cls: 'bg-slate-100 text-slate-600', Icon: Clock },
};

const TAX_LABEL: Record<TaxRate, MessageKey> = {
  '23': 'inv.tax23', '8': 'inv.tax8', '5': 'inv.tax5', '0': 'inv.tax0', np: 'inv.taxNp', zw: 'inv.taxZw',
};

/** Фактура по заказу: выставить в Fakturownia (+ KSeF) или показать выставленную. */
export default function InvoiceBlock({ tripId, provider, issued, defaults, clientId, clientName, clientMissing }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tax, setTax] = useState<TaxRate>(defaults.tax);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.message ?? null);
    });

  const header = (
    <div>
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
        {t('inv.block')}
      </h2>
      {provider && (
        <p className="text-xs text-slate-500 mt-1">
          {t(provider.autoKsef ? 'inv.blockHintAuto' : 'inv.blockHintManual', { provider: provider.name })}
        </p>
      )}
    </div>
  );

  if (!provider) {
    return (
      <div className="card p-5 md:p-6 space-y-2">
        {header}
        <p className="text-sm text-slate-600">{t('inv.notConfigured')}</p>
      </div>
    );
  }

  if (issued) {
    const state = ksefStateOf(issued.ksefStatus);
    const ui = STATE_UI[state];
    return (
      <div className="card p-5 md:p-6 space-y-4">
        {header}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-slate-900">
            {t('inv.number')}: {issued.invoiceNumber ?? '—'}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ui.cls}`}>
            <ui.Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
            {t(ui.label)}
          </span>
          {issued.ksefNumber && (
            <span className="text-xs text-slate-500 font-mono">
              {t('inv.ksefNumber')}: {issued.ksefNumber}
            </span>
          )}
        </div>
        {state === 'pending' && (
          <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
            {t('inv.manualKsef', { provider: provider.name })}{' '}
            <a href={provider.appUrl} target="_blank" rel="noopener" className="underline font-medium inline-flex items-center gap-1">
              {t('inv.openProvider', { provider: provider.name })}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </p>
        )}
        {issued.ksefError && state === 'error' && (
          <p className="text-sm text-red-600 break-words">{issued.ksefError}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/invoices/${tripId}/pdf`} target="_blank" rel="noopener" className="btn btn-secondary text-sm">
            <Download className="w-4 h-4" />
            {t('inv.pdf')}
          </a>
          <button type="button" disabled={isPending} onClick={() => run(() => refreshInvoice(tripId))} className="btn btn-secondary text-sm disabled:opacity-50">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('inv.refresh')}
          </button>
          {provider.autoKsef && (state === 'error' || state === 'none') && (
            <button type="button" disabled={isPending} onClick={() => run(() => resendInvoiceToKsef(tripId))} className="btn btn-primary text-sm disabled:opacity-50">
              <Send className="w-4 h-4" />
              {t('inv.resend')}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form className="card p-5 md:p-6 space-y-4" action={(fd) => run(() => issueInvoice(tripId, fd))}>
      {header}

      <div className="text-sm text-slate-700">
        {t('inv.buyer')}: <span className="font-semibold">{clientName ?? '—'}</span>
        {clientMissing.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-50 text-amber-800 p-3 text-sm">
            {t('inv.clientMissing')} {clientMissing.map((k) => t(k)).join(', ')}.{' '}
            {clientId && (
              <Link href={`/clients/${clientId}/edit`} className="underline font-medium">
                {t('inv.editClient')}
              </Link>
            )}
          </div>
        )}
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.position')}</span>
        <input name="position_name" defaultValue={defaults.positionName} maxLength={256} className="input" required />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.net')}</span>
          <input name="net_amount" type="number" step="0.01" min="0.01" defaultValue={defaults.netAmount ?? ''} className="input" required />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.currency')}</span>
          <select name="currency" defaultValue="EUR" className="input">
            <option value="EUR">EUR</option>
            <option value="PLN">PLN</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.vat')}</span>
          <select name="tax" value={tax} onChange={(e) => setTax(e.target.value as TaxRate)} className="input">
            {TAX_RATES.map((r) => (
              <option key={r} value={r}>{t(TAX_LABEL[r])}</option>
            ))}
          </select>
        </label>
      </div>

      {tax === 'np' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.npKind')}</span>
            <select name="np_kind" defaultValue={defaults.npKind ?? 'export_service_eu'} className="input">
              <option value="export_service_eu">{t('inv.npEu')}</option>
              <option value="export_service">{t('inv.npOutside')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:pt-6">
            <input type="checkbox" name="reverse_charge" defaultChecked={defaults.reverseCharge} />
            {t('inv.reverseCharge')}
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.issueDate')}</span>
          <input type="date" name="issue_date" defaultValue={defaults.issueDate} className="input" required />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.sellDate')}</span>
          <input type="date" name="sell_date" defaultValue={defaults.sellDate} className="input" required />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('recv.paymentDays')}</span>
          <input type="number" name="payment_days" min={0} max={365} defaultValue={defaults.paymentDays} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.lang')}</span>
          <select name="lang" defaultValue={defaults.lang} className="input">
            <option value="pl">PL</option>
            <option value="pl/en">PL / EN</option>
            <option value="en">EN</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t('inv.note')}</span>
        <input name="note" maxLength={200} className="input" />
      </label>

      {provider.autoKsef ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="send_ksef" defaultChecked />
          {t('inv.sendKsef')}
        </label>
      ) : (
        <p className="text-xs text-slate-500">{t('inv.manualKsef', { provider: provider.name })}</p>
      )}

      <p className="text-xs text-slate-500">{t('inv.vatHint')}</p>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending || clientMissing.length > 0} className="btn btn-primary text-sm disabled:opacity-50">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {t('inv.issue')}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
