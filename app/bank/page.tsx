import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Landmark, KeyRound } from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { fetchAll } from '../../lib/fetch-all';
import { getSessionContext } from '../../lib/session';
import { can, deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import { INTL_LOCALE } from '../../lib/i18n/config';
import { formatDate } from '../../lib/i18n/format';
import type { MessageKey } from '../../lib/i18n/translate';
import { OVERHEAD_CATEGORIES } from '../../lib/payables/overhead-rules';
import { loadPurchaseRefs, loadTripRefs } from '../../lib/bank/refs';
import { UploadStatements, TxActions, AcceptAllButton, DeleteStatementButton, RematchButton, type PickOpt } from './BankControls';

export const dynamic = 'force-dynamic';

type Show = 'new' | 'matched' | 'ignored' | 'all';
const SHOWS: Show[] = ['new', 'matched', 'ignored', 'all'];

export default async function BankPage(props: { searchParams: Promise<{ show?: string; st?: string }> }) {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'bank.view');
  if (denied) redirect(denied);
  try {
    return await BankView({ ...props, role });
  } catch (e) {
    // Раздел офиса и бухгалтера: показываем причину, а не общую заглушку.
    const { t } = await getT();
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bank] page', msg);
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="card p-6 text-sm text-red-700 break-words">{t('dir.error')} {msg}</div>
      </div>
    );
  }
}

async function BankView({ searchParams, role }: { searchParams: Promise<{ show?: string; st?: string }>; role: string | null }) {
  const canEdit = can(role, 'bank.edit');
  const { t, locale } = await getT();
  const sp = await searchParams;
  const show: Show = SHOWS.includes(sp.show as Show) ? (sp.show as Show) : 'new';
  const st = sp.st && /^[0-9a-f-]{36}$/i.test(sp.st) ? sp.st : null;
  // Код валюты из базы бывает нестандартным («EURO», «zł») — Intl тогда бросает RangeError.
  const money = (n: number | null, cur: string | null) => {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    try {
      return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: (cur || 'PLN').trim().toUpperCase(), maximumFractionDigits: 2 }).format(Number(n));
    } catch {
      return `${Number(n).toFixed(2)} ${cur ?? ''}`.trim();
    }
  };
  const supabase = await createClient();

  const { data: statements, error } = await supabase
    .from('bank_statements')
    .select('id, account, currency, period_from, period_to, number, file_name')
    .order('period_to', { ascending: false })
    .order('account');
  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="card p-6 flex gap-3 text-sm text-slate-600"><KeyRound className="w-5 h-5 text-amber-500 shrink-0" />{t('pay.needMigration')}</div>
      </div>
    );
  }

  let q = supabase
    .from('bank_transactions')
    .select('id, statement_id, currency, booking_date, amount, counterparty, title, op_type, kind, status, suggestion, purchase_invoice_ids, trip_ids, overhead_category')
    .order('booking_date', { ascending: false })
    .order('seq', { ascending: false });
  if (show !== 'all') q = q.eq('status', show);
  if (st) q = q.eq('statement_id', st);
  const { data: txRows } = await fetchAll(q);
  const txs = (txRows ?? []) as any[];

  const { data: countRows } = await fetchAll(supabase.from('bank_transactions').select('statement_id, status').order('id'));
  const counts = { new: 0, matched: 0, ignored: 0, all: 0 } as Record<Show, number>;
  const newBySt = new Map<string, number>();
  const totalBySt = new Map<string, number>();
  for (const r of (countRows ?? []) as { statement_id: string; status: Show }[]) {
    totalBySt.set(r.statement_id, (totalBySt.get(r.statement_id) ?? 0) + 1);
    if (st && r.statement_id !== st) continue;
    counts[r.status]++;
    counts.all++;
    if (r.status === 'new') newBySt.set(r.statement_id, (newBySt.get(r.statement_id) ?? 0) + 1);
  }

  // Справочники для подписей и ручного выбора.
  const [purchases, trips] = txs.length ? await Promise.all([loadPurchaseRefs(supabase), loadTripRefs(supabase)]) : [[], []];
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));
  const tripById = new Map(trips.map((x) => [x.id, x]));
  const unpaidPurchaseIds = new Set<string>();
  if (txs.some((x) => x.status === 'new' && Number(x.amount) < 0)) {
    const { data: unpaid } = await fetchAll(supabase.from('purchase_invoices').select('id, bank_transaction_id').order('id'));
    for (const r of (unpaid ?? []) as any[]) {
      // уже оплаченные по выписке — не предлагаем второй раз
      if (!r.bank_transaction_id) unpaidPurchaseIds.add(r.id);
    }
  }
  const invLabel = (id: string) => {
    const p = purchaseById.get(id);
    return p ? `${p.number ?? '—'} · ${p.sellerName ?? ''} · ${money(p.gross, p.currency)}` : id.slice(0, 8);
  };
  const tripLabel = (id: string) => {
    const x = tripById.get(id);
    return x ? `№${x.tripNumber ?? '?'}${x.invoiceNumber ? ` · ${x.invoiceNumber}` : ''} · ${x.clientName ?? ''} · ${money(x.amount, x.currency)}` : id.slice(0, 8);
  };
  const ohLabel = (c: string | null | undefined) => {
    const o = OVERHEAD_CATEGORIES.find((x) => x.value === c);
    return o ? `${o.emoji} ${t(`ohCat.${o.value}` as MessageKey)}` : '';
  };
  const ohOptions = OVERHEAD_CATEGORIES.map((c) => ({ value: c.value, label: ohLabel(c.value) }));

  // Ручной выбор: ближайшие по сумме в той же валюте (до 40).
  const pickFor = (tx: any): PickOpt[] => {
    const amount = Math.abs(Number(tx.amount));
    const cur = String(tx.currency).toUpperCase();
    if (Number(tx.amount) < 0) {
      return purchases
        .filter((p) => (p.currency || 'PLN').toUpperCase() === cur && unpaidPurchaseIds.has(p.id))
        .sort((a, b) => Math.abs((a.gross ?? 0) - amount) - Math.abs((b.gross ?? 0) - amount))
        .slice(0, 40)
        .map((p) => ({ id: p.id, label: invLabel(p.id) }));
    }
    return trips
      .filter((x) => !x.paid && (x.currency || 'EUR').toUpperCase() === cur)
      .sort((a, b) => Math.abs((a.amount ?? 0) - amount) - Math.abs((b.amount ?? 0) - amount))
      .slice(0, 40)
      .map((x) => ({ id: x.id, label: tripLabel(x.id) }));
  };

  const describe = (s: any): string | null => {
    if (!s) return null;
    if (s.type === 'purchases') return `${t(s.exact ? 'bank.sugExact' : 'bank.sugProbable')} ${s.ids.map(invLabel).join('; ')}`;
    if (s.type === 'trips') return `${t(s.exact ? 'bank.sugExact' : 'bank.sugProbable')} ${s.ids.map(tripLabel).join('; ')}`;
    if (s.type === 'overhead') return `${t('bank.sugOverhead')} ${ohLabel(s.category)}`;
    return t('bank.sugIgnore');
  };
  const decided = (x: any): string => {
    if (x.status === 'ignored') return t('bank.skipped');
    if (x.overhead_category) return `${t('bank.toOverhead')}: ${ohLabel(x.overhead_category)}`;
    if (x.purchase_invoice_ids?.length) return `${t('bank.paidInvoices')}: ${x.purchase_invoice_ids.map(invLabel).join('; ')}`;
    if (x.trip_ids?.length) return `${t('bank.paidTrips')}: ${x.trip_ids.map(tripLabel).join('; ')}`;
    return '';
  };
  const stLabel = (s: any) => `${s.currency} ···${String(s.account).slice(-4)} · ${formatDate(s.period_from, locale)} – ${formatDate(s.period_to, locale)}`;
  const href = (o: { show?: Show; st?: string | null }) => {
    const p = new URLSearchParams();
    const sh = o.show ?? show;
    if (sh !== 'new') p.set('show', sh);
    const s = o.st === undefined ? st : o.st;
    if (s) p.set('st', s);
    const qs = p.toString();
    return `/bank${qs ? `?${qs}` : ''}`;
  };
  const suggestedCount = txs.filter((x) => x.status === 'new' && x.suggestion).length;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Landmark className="w-6 h-6 text-brand-600" />{t('bank.title')}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">{t('bank.subtitle')}</p>
        </div>
        {canEdit && <UploadStatements />}
      </header>

      {(statements ?? []).length > 0 && (
        <section className="card p-4 md:p-5">
          <h2 className="font-bold text-slate-900 mb-2">{t('bank.statements')}</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={href({ st: null })} className={`px-2.5 py-1 rounded-lg text-xs border ${!st ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t('bank.allStatements')}</Link>
            {(statements ?? []).map((s: any) => (
              <span key={s.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${st === s.id ? 'bg-brand-50 border-brand-300' : 'border-slate-200'}`}>
                <Link href={href({ st: s.id })} className={st === s.id ? 'text-brand-700 font-semibold' : 'text-slate-700 hover:underline'}>{stLabel(s)}</Link>
                <span className="text-slate-400">{t('bank.ops', { n: totalBySt.get(s.id) ?? 0 })}</span>
                {(newBySt.get(s.id) ?? 0) > 0 && <span className="text-amber-700 font-semibold">{t('bank.toDecide', { n: newBySt.get(s.id) ?? 0 })}</span>}
                {canEdit && <DeleteStatementButton statementId={s.id} label={stLabel(s)} />}
              </span>
            ))}
          </div>
        </section>
      )}

      {(statements ?? []).length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">{t('bank.empty')}</div>
      ) : (
        <section className="card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <nav className="flex flex-wrap gap-1">
              {SHOWS.map((s) => (
                <Link key={s} href={href({ show: s })}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${show === s ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {t(`bank.show_${s}` as MessageKey)} ({counts[s]})
                </Link>
              ))}
            </nav>
            {canEdit && show === 'new' && (
              <div className="flex flex-wrap items-start gap-2">
                {counts.new > 0 && <RematchButton />}
                {suggestedCount > 0 && <AcceptAllButton statementId={st} count={suggestedCount} />}
              </div>
            )}
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">{t('bank.nothing')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {txs.map((x) => {
                const amount = Number(x.amount);
                return (
                  <div key={x.id} className="py-3 flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-4">
                    <div className="lg:w-28 shrink-0 text-xs text-slate-500">
                      {formatDate(x.booking_date, locale)}
                      <div className={`text-sm font-semibold tabular-nums ${amount < 0 ? 'text-slate-900' : 'text-emerald-700'}`}>{money(amount, x.currency)}</div>
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-medium text-slate-900 break-words">{x.counterparty || x.op_type}</div>
                      {x.title && <div className="text-xs text-slate-500 break-words">{x.title}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t(`bank.kind_${x.kind}` as MessageKey)}</span>
                        {x.status === 'new' && describe(x.suggestion) && <span className="text-sky-700">{describe(x.suggestion)}</span>}
                        {x.status !== 'new' && <span className="text-emerald-700">{decided(x)}</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="lg:w-80 shrink-0">
                        <TxActions
                          txId={x.id}
                          status={x.status}
                          outgoing={amount < 0}
                          suggestion={x.suggestion}
                          picks={x.status === 'new' && x.kind !== 'internal' ? pickFor(x) : []}
                          categories={ohOptions}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
