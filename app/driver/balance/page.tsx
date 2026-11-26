import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../lib/session';
import { createClient as createAuthClient } from '../../../lib/supabase/server';
import {
  ArrowLeft,
  HandCoins,
  ArrowDownCircle,
  ArrowUpCircle,
  Inbox,
} from 'lucide-react';
import { isDriverRole } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { formatDate } from '../../../lib/i18n/format';
import { formatEur } from '../../../lib/i18n/format';

export const dynamic = 'force-dynamic';


export default async function DriverBalancePage() {
  const { t: tr, locale } = await getT();
  const { role, driverId } = await getSessionContext();

  if (!isDriverRole(role) || !driverId) {
    redirect('/login');
  }

  // RLS-клиент вместо service_role: выборка ограничивается политиками
  // RLS, поэтому водитель видит только свои данные.
  const supabase = await createAuthClient();

  const { data: transactions } = await supabase
    .from('driver_transactions')
    .select('*')
    .eq('driver_id', driverId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  let accruedTotal = 0;
  let paidOutTotal = 0;
  for (const t of transactions || []) {
    if (t.type === 'accrual') accruedTotal += Number(t.amount_eur) || 0;
    else if (t.type === 'payout') paidOutTotal += Number(t.amount_eur) || 0;
  }
  const balance = accruedTotal - paidOutTotal;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[700px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {tr('rt.back')}
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <HandCoins className="w-6 h-6 text-brand-600" strokeWidth={2.2} />
            {tr('nav.myBalance')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {tr('drvApp.balanceHint')}
          </p>
        </div>

        {/* Баланс */}
        <div className={`rounded-2xl p-6 shadow-lg ${
          balance > 0
            ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
            : balance < 0
              ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
              : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
        }`}>
          <div className="text-sm text-white/80">
            {balance > 0
              ? tr('drvApp.companyOwes')
              : balance < 0
                ? tr('drvApp.youOwe')
                : tr('drvFin.closed')}
          </div>
          <div className="text-4xl font-bold mt-1 tabular-nums">
            {formatEur(Math.abs(balance), 2)}
          </div>
          <div className="flex gap-x-4 gap-y-1 mt-4 text-xs text-white/80 flex-wrap">
            <span>{tr('drvFin.accrued')}{' '}<b className="text-white tabular-nums">{formatEur(accruedTotal, 2)}</b></span>
            <span>·</span>
            <span>{tr('drvFin.paidOut')}{' '}<b className="text-white tabular-nums">{formatEur(paidOutTotal, 2)}</b></span>
          </div>
        </div>

        {/* История операций */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            {tr('drvApp.ops')}
          </h2>

          {!transactions || transactions.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-slate-400 text-sm">
                {tr('drvApp.noOps')}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                {tr('drvApp.noOpsHint')}
              </div>
            </div>
          ) : (
            <div className="card divide-y divide-slate-100">
              {transactions.map((t: any) => (
                <div key={t.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {t.type === 'accrual' ? (
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <ArrowDownCircle className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <ArrowUpCircle className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">
                        {t.type === 'accrual' ? tr('drvFin.accruedOne') : tr('drvFin.paidOne')}
                      </div>
                      {t.notes && (
                        <div className="text-xs text-slate-500 break-words mt-0.5">
                          {t.notes}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        {formatDate(t.date, locale)}
                        {t.original_amount && t.currency && t.currency !== 'EUR' && (
                          <> · {t.original_amount} {t.currency}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold whitespace-nowrap tabular-nums shrink-0 ${
                    t.type === 'accrual' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {t.type === 'accrual' ? '+' : '−'}{formatEur(Number(t.amount_eur), 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
