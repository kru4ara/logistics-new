import Link from 'next/link';
import { ReceiptText, FileText, AlertTriangle } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAllByIds } from '../../../lib/fetch-all';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { formatDate } from '../../../lib/i18n/format';
import { toEur } from '../../../lib/fx';
import { signDocumentPaths } from '../../../lib/storage-urls';
import { costDiff, MANUAL_CURRENCIES } from '../../../lib/payables/cost-rules';
import { UnlinkButton } from '../../payables/PayablesControls';
import { AddManualInvoice, DeleteManualInvoice } from './ContractorInvoicesForms';

type Seg = {
  id: string;
  position: number;
  contractorName: string | null;
  price: number | null;
  currency: string | null;
  dateFrom: string | null;
};

type Inv = {
  id: string;
  source: 'ksef' | 'manual';
  segment_id: string;
  invoice_number: string | null;
  issue_date: string | null;
  net_amount: number | null;
  gross_amount: number | null;
  currency: string | null;
  payment_due: string | null;
  paid_at: string | null;
  file_path: string | null;
  ksef_number: string | null;
};

/** Счета подрядчиков по участкам рейса: план (заявка) против факта (счета), ручной ввод. */
export default async function ContractorInvoices({
  segments,
  actualEurBySegment,
  canEdit,
}: {
  segments: Seg[];
  /** сумма расхода «Подрядчик» участка в EUR — уже по счетам, если они есть */
  actualEurBySegment: Record<string, number>;
  canEdit: boolean;
}) {
  if (!segments.length) return null;
  const { t, locale } = await getT();
  const money = (n: number | null, cur: string | null) =>
    n == null ? '—' : new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(n);

  const supabase = await createClient();
  const { data, error } = await fetchAllByIds(
    segments.map((s) => s.id),
    (chunk) =>
      supabase
        .from('purchase_invoices')
        .select('id, source, segment_id, invoice_number, issue_date, net_amount, gross_amount, currency, payment_due, paid_at, file_path, ksef_number')
        .in('segment_id', chunk),
  );
  // До миграции 028/029 таблицы может не быть — блок просто не показываем.
  if (error) return null;
  const invoices = ((data ?? []) as any[]).map(
    (r): Inv => ({ ...r, net_amount: r.net_amount != null ? Number(r.net_amount) : null, gross_amount: r.gross_amount != null ? Number(r.gross_amount) : null }),
  );
  const urls = await signDocumentPaths(invoices.map((i) => i.file_path));
  const today = new Date().toISOString().slice(0, 10);

  const rows = await Promise.all(
    segments.map(async (s) => {
      const planEur = s.price != null && s.price > 0 ? await toEur(supabase, s.price, s.currency, s.dateFrom || today) : null;
      const list = invoices.filter((i) => i.segment_id === s.id).sort((a, b) => (a.issue_date ?? '').localeCompare(b.issue_date ?? ''));
      const actualEur = list.length ? actualEurBySegment[s.id] ?? null : null;
      return { s, planEur, list, actualEur, diff: costDiff(planEur, actualEur) };
    }),
  );

  return (
    <div className="card p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-brand-600" strokeWidth={2} />
          {t('pay.block')}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{t('pay.blockHint')}</p>
      </div>

      {rows.map(({ s, planEur, list, actualEur, diff }) => (
        <div key={s.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">
              {t('pay.leg', { n: s.position })} · {s.contractorName ?? '—'}
            </div>
            <div className="text-xs text-slate-600 flex flex-wrap gap-3 tabular-nums">
              <span>{t('pay.plan')}: {money(s.price, s.currency)}{s.currency && s.currency !== 'EUR' && planEur != null ? ` ≈ ${money(planEur, 'EUR')}` : ''}</span>
              {actualEur != null && <span className="font-semibold text-slate-900">{t('pay.fact')}: {money(actualEur, 'EUR')}</span>}
            </div>
          </div>

          {diff?.notable && (
            <div className={`text-xs flex items-center gap-1 ${diff.diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {t(diff.diff > 0 ? 'pay.diffMore' : 'pay.diffLess', { amount: money(Math.abs(diff.diff), 'EUR'), pct: Math.abs(diff.pct ?? 0) })}
            </div>
          )}

          {list.length === 0 ? (
            <p className="text-xs text-slate-400">{t('pay.noInvoices')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {list.map((i) => (
                <li key={i.id} className="py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{i.invoice_number ?? '—'}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{i.source === 'ksef' ? t('pay.srcKsef') : t('pay.srcManual')}</span>
                  <span className="text-xs text-slate-500">{i.issue_date ? formatDate(i.issue_date, locale) : ''}</span>
                  <span className="tabular-nums">{t('pay.net')} {money(i.net_amount, i.currency)}</span>
                  <span className="text-xs text-slate-500">
                    {i.paid_at ? t('pay.paidOn', { date: formatDate(i.paid_at, locale) }) : i.payment_due ? `${t('pay.due')}: ${formatDate(i.payment_due, locale)}${i.payment_due < today ? ' ⚠' : ''}` : ''}
                  </span>
                  {i.file_path && urls[i.file_path] && (
                    <a href={urls[i.file_path]} target="_blank" rel="noopener" className="text-brand-600 hover:underline text-xs inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />{t('pay.file')}
                    </a>
                  )}
                  {canEdit && (
                    <span className="ml-auto inline-flex items-center gap-2">
                      {i.source === 'manual'
                        ? <DeleteManualInvoice invoiceId={i.id} number={i.invoice_number ?? ''} />
                        : <UnlinkButton invoiceId={i.id} />}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && <AddManualInvoice segmentId={s.id} currency={(s.currency || 'EUR').toUpperCase()} currencies={MANUAL_CURRENCIES} />}
        </div>
      ))}

      <Link href="/payables" className="text-xs text-brand-600 hover:underline">{t('pay.title')} →</Link>
    </div>
  );
}
