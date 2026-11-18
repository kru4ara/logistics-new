import Link from 'next/link';
import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { deleteFixedCost, dismissCostDouble } from '../fixed-cost-actions';
import { fetchAll, fetchAllByIds } from '../../lib/fetch-all';
import { findManualDuplicates, FC_NOT_DOUBLE_KEY, findBankInvoiceDuplicates, type InvoiceAmounts } from '../../lib/fixed-costs-dup-rules';
import { linkBankCostToInvoice } from '../bank/actions';
import { OVERHEAD_CATEGORIES } from '../../lib/payables/overhead-rules';
import { costClassOf, isOperatingCost } from '../../lib/cost-class';
import ConfirmSubmit from '../components/ConfirmSubmit';
import {
  Banknote,
  Plus,
  Calendar,
  TrendingDown,
  BarChart3,
  Inbox,
  Briefcase,
  Pencil,
  Trash2,
  Repeat,
  CalendarClock,
  Coins,
  Zap,
  ReceiptText,
  Landmark,
  Copy,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import { INTL_LOCALE } from '../../lib/i18n/config';
import type { MessageKey } from '../../lib/i18n/translate';
import { tPlural } from '../../lib/i18n/translate';

export const dynamic = 'force-dynamic';

type MonthGroup = {
  month_key: string;
  items: any[];
  total: number;
  capexTotal: number;
  operationalTotal: number;
  /** вне P&L: дивиденды и снятые наличные */
  dividendsTotal: number;
  cashTotal: number;
};

const costTypeMeta: Record<string, { label: MessageKey; Icon: LucideIcon; badge: string }> = {
  yearly: { label: 'fc.typeYearly', Icon: CalendarClock, badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  monthly: { label: 'fc.typeMonthly', Icon: Repeat, badge: 'bg-brand-50 text-brand-700 border-brand-200' },
  installment: { label: 'fc.typeInstallment', Icon: Coins, badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  one_time: { label: 'fc.typeOneTime', Icon: Zap, badge: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const currencySymbol: Record<string, string> = {
  PLN: 'PLN',
  BYN: 'BYN',
  EUR: '€',
};

export default async function FixedCostsPage() {
  const { t, locale } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'fixedCosts.view');
  if (denied) redirect(denied);

  const supabase = await createClient();

  const { data: costsRaw, error } = await fetchAll(
    supabase
      .from('fixed_costs')
      .select('*')
      .order('month_key', { ascending: false })
      .order('expense_date', { ascending: false })
      .order('id'),
  );
  const costs = costsRaw as any[] | null;

  if (error) {
    return <div className="p-8 text-red-500">{t('dir.loadError')}{' '}{error.message}</div>;
  }

  // Записи из счетов подрядчиков («не относится к рейсам» + категория) и ручные дубли к ним.
  const invoiceIds = (costs ?? []).map((c) => c.purchase_invoice_id).filter((x): x is string => Boolean(x));
  const { data: invRows } = invoiceIds.length
    ? await fetchAllByIds(invoiceIds, (chunk) =>
        supabase.from('purchase_invoices').select('id, gross_amount, net_amount, invoice_number, issue_date, overhead_category').in('id', chunk),
      )
    : { data: [] as any[] };
  const invoiceById = new Map<string, InvoiceAmounts & { category: string | null }>(
    ((invRows ?? []) as any[]).map((r) => [
      r.id,
      {
        gross: r.gross_amount != null ? Number(r.gross_amount) : null,
        net: r.net_amount != null ? Number(r.net_amount) : null,
        number: r.invoice_number,
        issueDate: r.issue_date,
        category: r.overhead_category,
      },
    ]),
  );
  const costById = new Map((costs ?? []).map((c) => [c.id, c]));
  // Строки из выписки — тоже «не ручные»: ручная запись того же платежа — дубль.
  const dupSources = new Map<string, InvoiceAmounts>(invoiceById);
  for (const c of costs ?? []) {
    if (c.bank_transaction_id) {
      dupSources.set(`bank:${c.bank_transaction_id}`, {
        gross: c.original_amount != null ? Number(c.original_amount) : null,
        net: null,
        number: null,
        issueDate: c.expense_date,
      });
    }
  }
  const { data: fcNd } = await supabase.from('integration_state').select('value').eq('key', FC_NOT_DOUBLE_KEY).maybeSingle();
  let notDouble = new Set<string>();
  try {
    notDouble = new Set(JSON.parse(fcNd?.value ?? '[]') as string[]);
  } catch {
    /* повреждённый список — показываем все пары */
  }
  const dupPairs = findManualDuplicates(
    (costs ?? []).filter((c) => !notDouble.has(c.id)).map((c) => ({
      ...c,
      original_amount: c.original_amount != null ? Number(c.original_amount) : null,
      purchase_invoice_id: c.purchase_invoice_id ?? (c.bank_transaction_id ? `bank:${c.bank_transaction_id}` : null),
    })),
    dupSources,
  );
  const dupManualIds = new Set(dupPairs.map((p) => p.manualId));
  const bankDupPairs = findBankInvoiceDuplicates(
    (costs ?? []).map((c) => ({ ...c, original_amount: c.original_amount != null ? Number(c.original_amount) : null })),
    invoiceById,
  );
  for (const p of bankDupPairs) dupManualIds.add(p.bankCostId);
  const { count: unsorted } = await supabase
    .from('purchase_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('match_status', 'ignored')
    .is('overhead_category', null);
  const ohLabel = (cat: string | null | undefined) => {
    const c = OVERHEAD_CATEGORIES.find((x) => x.value === cat);
    return c ? `${c.emoji} ${t(`ohCat.${c.value}` as MessageKey)}` : null;
  };
  const fmtCost = (c: any) =>
    `${c.original_amount ?? c.amount_eur ?? 0} ${c.currency || 'PLN'} · ${c.expense_date ? new Date(c.expense_date).toLocaleDateString(INTL_LOCALE[locale]) : c.month_key}`;
  const invoiceBadge = (c: any) => c.bank_transaction_id ? (
    <Link href="/bank?show=matched" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">
      <Landmark className="w-2.5 h-2.5" strokeWidth={2.5} />
      {t('bank.fromBank')}
    </Link>
  ) : (
    <Link href="/payables" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100">
      <ReceiptText className="w-2.5 h-2.5" strokeWidth={2.5} />
      {ohLabel(invoiceById.get(c.purchase_invoice_id)?.category) ?? t('payx3.fromInvoice')}
    </Link>
  );

  const classBadge = (c: any) => {
    const cls = costClassOf(c);
    if (cls === 'operating') return null;
    return (
      <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls === 'dividends' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
        {t(`cclass.${cls}` as MessageKey)} · {t('cclass.notPl')}
      </span>
    );
  };

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Операционные vs инвестиции
  const operationalCosts = costs?.filter((c) => isOperatingCost(c)) || [];
  const capexCosts = costs?.filter((c) => c.is_capex) || [];
  // Вне P&L, но на виду: вывод собственникам и снятые наличные.
  const dividendCosts = costs?.filter((c) => !c.is_capex && costClassOf(c) === 'dividends') || [];
  const cashCosts = costs?.filter((c) => !c.is_capex && costClassOf(c) === 'cash') || [];
  const sumEur = (xs: any[]) => xs.reduce((s, c) => s + (c.amount_eur || 0), 0);

  const yearlyTotal = operationalCosts
    .filter((c) => c.cost_type === 'yearly')
    .reduce((sum, c) => sum + (c.amount_eur || 0), 0);

  const currentMonthOperational = operationalCosts.filter((c) => c.month_key === currentMonthKey);
  const currentMonthActual = currentMonthOperational.reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const currentMonthYearlyPart = currentMonthOperational
    .filter((c) => c.cost_type === 'yearly')
    .reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const effectiveMonthly = currentMonthActual - currentMonthYearlyPart + yearlyTotal / 12;

  const totalCapexAllTime = capexCosts.reduce((sum, c) => sum + (c.amount_eur || 0), 0);

  // Группировка по месяцам (операционные + капекс отдельно)
  const costsByMonth: Record<string, MonthGroup> = {};
  costs?.forEach((c) => {
    if (!c.month_key) return;
    if (!costsByMonth[c.month_key]) {
      costsByMonth[c.month_key] = {
        month_key: c.month_key,
        items: [],
        total: 0,
        capexTotal: 0,
        operationalTotal: 0,
        dividendsTotal: 0,
        cashTotal: 0,
      };
    }
    const amount = c.amount_eur || 0;
    costsByMonth[c.month_key].items.push(c);
    costsByMonth[c.month_key].total += amount;
    const cls = costClassOf(c);
    if (c.is_capex) {
      costsByMonth[c.month_key].capexTotal += amount;
    } else if (cls === 'dividends') {
      costsByMonth[c.month_key].dividendsTotal += amount;
    } else if (cls === 'cash') {
      costsByMonth[c.month_key].cashTotal += amount;
    } else {
      costsByMonth[c.month_key].operationalTotal += amount;
    }
  });

  Object.values(costsByMonth).forEach((group) => {
    group.items.sort((a, b) => {
      const da = a.expense_date ? new Date(a.expense_date).getTime() : 0;
      const db = b.expense_date ? new Date(b.expense_date).getTime() : 0;
      if (db !== da) return db - da;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
  });

  const months: MonthGroup[] = Object.values(costsByMonth);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Banknote className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              {t('nav.fixedCosts')}
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              {t('fc.hint')}
            </p>
          </div>
          <Link href="/fixed-costs/new" className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            {t('trip.addExpense')}
          </Link>
        </div>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">{t('fc.thisMonth')}</span>
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500 break-words tabular-nums">
              {currentMonthActual.toFixed(0)} €
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {t('fc.operational')}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">{t('fc.effective')}</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 break-words tabular-nums">
              {effectiveMonthly.toFixed(0)} €
            </div>
            <div className="text-xs text-slate-400 mt-1 break-words">
              {t('fc.yearlyDiv', { n: yearlyTotal.toFixed(0) })}
            </div>
          </div>

          <div className="card p-4 md:p-5 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-amber-700">{t('fc.capexTotal')}</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-amber-600 break-words tabular-nums">
              {totalCapexAllTime > 0 ? `${totalCapexAllTime.toFixed(0)} €` : '—'}
            </div>
            <div className="text-xs text-amber-600/70 mt-1">
              {t('fc.outsidePl', { ops: tPlural(t, locale, 'count2.op', capexCosts.length) })}
            </div>
          </div>
        </div>

        {(dividendCosts.length > 0 || cashCosts.length > 0) && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="card p-4 md:p-5 border-violet-200">
              <span className="text-xs md:text-sm font-medium text-violet-700">{t('cclass.dividendsTotal')}</span>
              <div className="text-2xl md:text-3xl font-bold text-violet-600 tabular-nums mt-1">
                {dividendCosts.length ? `${sumEur(dividendCosts).toFixed(0)} €` : '—'}
              </div>
              <div className="text-xs text-violet-600/70 mt-1">{t('fc.outsidePl', { ops: tPlural(t, locale, 'count2.op', dividendCosts.length) })}</div>
            </div>
            <div className="card p-4 md:p-5 border-slate-300">
              <span className="text-xs md:text-sm font-medium text-slate-600">{t('cclass.cashTotal')}</span>
              <div className="text-2xl md:text-3xl font-bold text-slate-700 tabular-nums mt-1">
                {cashCosts.length ? `${sumEur(cashCosts).toFixed(0)} €` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">{t('fc.outsidePl', { ops: tPlural(t, locale, 'count2.op', cashCosts.length) })}</div>
            </div>
          </div>
        )}

        {(unsorted ?? 0) > 0 && (
          <Link href="/payables#sort" className="card p-4 flex items-center gap-3 border-amber-300 bg-amber-50/50 hover:bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm text-slate-700">{t('payx3.unsortedBanner', { n: unsorted ?? 0 })}</span>
          </Link>
        )}

        {bankDupPairs.length > 0 && (
          <section className="card p-4 md:p-5 border-amber-300 bg-amber-50/40">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Copy className="w-4 h-4 text-amber-600" />{t('payx3.bankDupTitle', { n: bankDupPairs.length })}</h2>
            <p className="text-sm text-slate-600 mt-1 mb-3">{t('payx3.bankDupHint')}</p>
            <div className="divide-y divide-amber-100">
              {bankDupPairs.map((p) => {
                const b = costById.get(p.bankCostId);
                const k = costById.get(p.invoiceCostId);
                if (!b || !k) return null;
                const num = invoiceById.get(p.invoiceId)?.number ?? '';
                return (
                  <div key={p.bankCostId} className="py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 break-words">{b.category || t('fc.noCategory')}</div>
                      <div className="text-xs text-slate-500">{t('bank.fromBank')} · {fmtCost(b)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-700 break-words">{k.category}</div>
                      <div className="text-xs text-slate-500">{t('payx3.fromInvoice')} · {fmtCost(k)}</div>
                    </div>
                    <form action={async () => {
                      'use server';
                      await linkBankCostToInvoice(p.txId, p.invoiceId);
                    }}>
                      <ConfirmSubmit
                        message={t('payx3.bankDupConfirm', { num })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-violet-700 border border-violet-200 bg-white hover:bg-violet-50 whitespace-nowrap"
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        {t('payx3.bankDupLink')}
                      </ConfirmSubmit>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {dupPairs.length > 0 && (
          <section className="card p-4 md:p-5 border-amber-300 bg-amber-50/40">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Copy className="w-4 h-4 text-amber-600" />{t('payx3.dupTitle', { n: dupPairs.length })}</h2>
            <p className="text-sm text-slate-600 mt-1 mb-3">{t('payx3.dupHint')}</p>
            <div className="divide-y divide-amber-100">
              {dupPairs.map((p) => {
                const m = costById.get(p.manualId);
                const k = costById.get(p.invoiceCostId);
                if (!m || !k) return null;
                return (
                  <div key={p.manualId} className="py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 break-words">{m.category || t('fc.noCategory')}</div>
                      <div className="text-xs text-slate-500">{t('payx3.manual')} · {fmtCost(m)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-700 break-words">{k.category}</div>
                      <div className="text-xs text-slate-500">{k.bank_transaction_id ? t('bank.fromBank') : t('payx3.fromInvoice')} · {fmtCost(k)}{p.byNumber ? ` · ${t('payx3.sameNumber')}` : ''}</div>
                    </div>
                    <form action={async () => {
                      'use server';
                      await deleteFixedCost(p.manualId);
                    }}>
                      <ConfirmSubmit
                        message={t('payx.confirmFcDelete', { name: m.category ?? '' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('payx3.deleteManual')}
                      </ConfirmSubmit>
                    </form>
                    <form action={async () => {
                      'use server';
                      await dismissCostDouble(p.manualId);
                    }}>
                      <button type="submit" className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 whitespace-nowrap">
                        {t('payx5.notDouble')}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {months.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t('fc.empty')}</h2>
            <p className="text-slate-500 mb-6">{t('fc.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {months.map((m) => (
              <div key={m.month_key} className="card overflow-hidden">
                <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2} />
                    </div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900 capitalize">
                      {new Date(m.month_key + '-01').toLocaleDateString(INTL_LOCALE[locale], { month: 'long', year: 'numeric' })}
                    </h2>
                  </div>
                  <div className="flex items-baseline gap-4">
                    {m.dividendsTotal > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] md:text-xs uppercase tracking-wide text-violet-600 font-medium">{t('cclass.dividends')}</div>
                        <div className="text-sm md:text-base font-bold text-violet-600 tabular-nums">{m.dividendsTotal.toFixed(0)} €</div>
                      </div>
                    )}
                    {m.cashTotal > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] md:text-xs uppercase tracking-wide text-slate-500 font-medium">{t('cclass.cash')}</div>
                        <div className="text-sm md:text-base font-bold text-slate-600 tabular-nums">{m.cashTotal.toFixed(0)} €</div>
                      </div>
                    )}
                    {m.capexTotal > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] md:text-xs uppercase tracking-wide text-amber-600 font-medium">{t('fc.capex')}</div>
                        <div className="text-sm md:text-base font-bold text-amber-600 tabular-nums">{m.capexTotal.toFixed(0)} €</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400 font-medium">{t('fc.opex')}</div>
                      <div className="text-lg md:text-xl font-bold text-red-500 tabular-nums">{m.operationalTotal.toFixed(0)} €</div>
                    </div>
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {m.items.map((c: any) => {
                    const meta = c.cost_type && costTypeMeta[c.cost_type] ? costTypeMeta[c.cost_type] : null;
                    const originalAmount = c.original_amount ?? c.amount_pln ?? c.amount_eur ?? 0;
                    const curr = c.currency || 'PLN';
                    const isCapex = c.is_capex === true;
                    return (
                      <div key={c.id} className={`p-4 space-y-2 ${isCapex ? 'bg-amber-50/30' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <div className="font-semibold text-slate-800 break-words">
                                {c.category || t('fc.noCategory')}
                                {dupManualIds.has(c.id) && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t('payx3.dupBadge')}</span>}
                              </div>
                              {classBadge(c)}
                              {isCapex && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                  <Briefcase className="w-2.5 h-2.5" strokeWidth={2.5} />
                                  {t('fc.capexOne')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Calendar className="w-3 h-3" strokeWidth={2} />
                              <span className="tabular-nums">
                                {c.expense_date ? new Date(c.expense_date).toLocaleDateString(INTL_LOCALE[locale]) : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-slate-400 tabular-nums">
                              {originalAmount} {currencySymbol[curr] || curr}
                            </div>
                            <div className={`font-bold break-words tabular-nums ${isCapex ? 'text-amber-600' : 'text-red-500'}`}>
                              {c.amount_eur ? `${Number(c.amount_eur).toFixed(0)} €` : '—'}
                            </div>
                          </div>
                        </div>

                        {meta && (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badge}`}>
                              <meta.Icon className="w-3 h-3" strokeWidth={2.2} />
                              {t(meta.label)}
                            </span>
                          </div>
                        )}

                        {c.purchase_invoice_id || c.bank_transaction_id ? (
                          <div className="pt-2 border-t border-slate-100">{invoiceBadge(c)}</div>
                        ) : (
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <Link
                            href={`/fixed-costs/${c.id}/edit`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                            {t('trip.change')}
                          </Link>
                          <form action={async () => {
                            'use server';
                            await deleteFixedCost(c.id);
                          }} className="flex-1">
                            <ConfirmSubmit
                              message={t('payx.confirmFcDelete', { name: c.category ?? '' })}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30 text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                              {t('trips.delete')}
                            </ConfirmSubmit>
                          </form>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('addr.date')}</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('expense.category')}</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('fc.type')}</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('seg.amount')}</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('expense.inEur')}</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('fc.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.items.map((c: any) => {
                        const meta = c.cost_type && costTypeMeta[c.cost_type] ? costTypeMeta[c.cost_type] : null;
                        const originalAmount = c.original_amount ?? c.amount_pln ?? c.amount_eur ?? 0;
                        const curr = c.currency || 'PLN';
                        const isCapex = c.is_capex === true;
                        return (
                          <tr key={c.id} className={`border-b border-slate-50 transition-colors ${isCapex ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-brand-50/30'}`}>
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                              {c.expense_date ? new Date(c.expense_date).toLocaleDateString(INTL_LOCALE[locale]) : '—'}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.category || t('fc.noCategory')}
                                {dupManualIds.has(c.id) && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t('payx3.dupBadge')}</span>}
                                {classBadge(c)}
                                {isCapex && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                    <Briefcase className="w-2.5 h-2.5" strokeWidth={2.5} />
                                    {t('fc.capexOne')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {meta ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${meta.badge}`}>
                                  <meta.Icon className="w-3 h-3" strokeWidth={2.2} />
                                  {t(meta.label)}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700 font-medium whitespace-nowrap tabular-nums">
                              {originalAmount} {currencySymbol[curr] || curr}
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap tabular-nums ${isCapex ? 'text-amber-600' : 'text-red-500'}`}>
                              {c.amount_eur ? `${Number(c.amount_eur).toFixed(0)} €` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {c.purchase_invoice_id || c.bank_transaction_id ? invoiceBadge(c) : (<>
                              <Link
                                href={`/fixed-costs/${c.id}/edit`}
                                className="text-brand-600 hover:text-brand-800 text-xs font-medium px-2 py-1 inline-flex"
                                title={t('trip.change')}
                              >
                                <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                              </Link>
                              <form action={async () => {
                                'use server';
                                await deleteFixedCost(c.id);
                              }} className="inline">
                                <ConfirmSubmit
                                  message={t('payx.confirmFcDelete', { name: c.category ?? '' })}
                                  className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1"
                                  title={t('trips.delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                                </ConfirmSubmit>
                              </form>
                              </>)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
