import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Coins } from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { fetchAll } from '../../lib/fetch-all';
import { getSessionContext } from '../../lib/session';
import { can, deniedRedirect } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import { INTL_LOCALE } from '../../lib/i18n/config';
import { formatDate } from '../../lib/i18n/format';
import { INCOME_CATEGORIES, isIncomeCategory } from '../../lib/other-income';
import { AddIncomeForm, DeleteIncomeButton } from './IncomeControls';

export const dynamic = 'force-dynamic';

/** Прочие доходы: компенсации, возвраты, проценты — по месяцам, в P&L. */
export default async function IncomePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'fixedCosts.view');
  if (denied) redirect(denied);
  const canEdit = can(role, 'fixedCosts.edit');
  const { t, locale } = await getT();
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : new Date().getFullYear();
  const supabase = await createClient();
  const { data, error } = await fetchAll(
    supabase
      .from('other_income')
      .select('id, income_date, month_key, category, description, original_amount, currency, amount_eur, bank_transaction_id')
      .gte('income_date', `${year}-01-01`)
      .lte('income_date', `${year}-12-31`)
      .order('income_date', { ascending: false })
      .order('id'),
  );
  const rows = (data ?? []) as any[];
  const money = (n: number, cur: string | null) => {
    try {
      return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur ?? ''}`;
    }
  };
  const catLabel = (c: string) => t(`income.cat_${isIncomeCategory(c) ? c : 'other'}`);
  const byMonth = new Map<string, any[]>();
  for (const r of rows) byMonth.set(r.month_key, [...(byMonth.get(r.month_key) ?? []), r]);
  const total = rows.reduce((s, r) => s + Number(r.amount_eur ?? 0), 0);
  const monthFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Coins className="w-6 h-6 md:w-7 md:h-7 text-emerald-600" strokeWidth={2.2} />
              {t('income.title')}
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base max-w-3xl">{t('income.hint')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/income?year=${year - 1}`} className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50">←</Link>
            <span className="font-semibold">{year}</span>
            <Link href={`/income?year=${year + 1}`} className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50">→</Link>
          </div>
        </div>

        {error ? (
          <div className="card p-6 text-amber-800 bg-amber-50 border-amber-200">{t('income.needMigration')}</div>
        ) : (
          <>
            {canEdit && (
              <section className="card p-4 md:p-5">
                <AddIncomeForm categories={INCOME_CATEGORIES.map((c) => ({ value: c, label: t(`income.cat_${c}`) }))} today={today} />
              </section>
            )}

            <div className="text-sm font-semibold text-emerald-700">{t('income.total', { year, sum: money(total, 'EUR') })}</div>

            {rows.length === 0 ? (
              <div className="card p-10 text-center text-slate-500">{t('income.empty')}</div>
            ) : (
              [...byMonth.entries()].map(([mk, list]) => (
                <section key={mk} className="card p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-slate-900 capitalize">{monthFmt.format(new Date(`${mk}-15T00:00:00Z`))}</h2>
                    <span className="font-bold text-emerald-700">{money(list.reduce((s, r) => s + Number(r.amount_eur ?? 0), 0), 'EUR')}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {list.map((r) => (
                      <div key={r.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                        <span className="text-slate-500 w-24 whitespace-nowrap">{formatDate(r.income_date, locale)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-slate-900">{catLabel(r.category)}</span>
                          {r.description && <span className="text-slate-600 break-words"> · {r.description}</span>}
                          <span className="ml-1.5 text-[10px] uppercase text-slate-400">{r.bank_transaction_id ? t('income.fromBank') : t('income.manual')}</span>
                        </span>
                        <span className="font-semibold text-emerald-700 whitespace-nowrap">{money(Number(r.original_amount), r.currency)}</span>
                        {r.currency !== 'EUR' && <span className="text-xs text-slate-500 whitespace-nowrap">{money(Number(r.amount_eur ?? 0), 'EUR')}</span>}
                        {canEdit && !r.bank_transaction_id && <DeleteIncomeButton id={r.id} name={[catLabel(r.category), r.description].filter(Boolean).join(' · ')} />}
                        {canEdit && r.bank_transaction_id && <Link href="/bank?show=matched" className="text-xs text-brand-600 hover:underline whitespace-nowrap">{t('pay2.toBank')}</Link>}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
