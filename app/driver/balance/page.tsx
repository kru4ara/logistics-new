import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import {
  ArrowLeft,
  HandCoins,
  ArrowDownCircle,
  ArrowUpCircle,
  Inbox,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

export default async function DriverBalancePage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const supabase = await createClient();

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
          Назад
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <HandCoins className="w-6 h-6 text-brand-600" strokeWidth={2.2} />
            Мои расчёты
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Сколько компания должна вам за расходы, которые вы оплатили из своих.
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
              ? 'Компания должна вам'
              : balance < 0
                ? 'Вы должны компании'
                : 'Долг закрыт'}
          </div>
          <div className="text-4xl font-bold mt-1 tabular-nums">
            {Math.abs(balance).toFixed(2)} €
          </div>
          <div className="flex gap-x-4 gap-y-1 mt-4 text-xs text-white/80 flex-wrap">
            <span>Начислено: <b className="text-white tabular-nums">{accruedTotal.toFixed(2)} €</b></span>
            <span>·</span>
            <span>Выплачено: <b className="text-white tabular-nums">{paidOutTotal.toFixed(2)} €</b></span>
          </div>
        </div>

        {/* История операций */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            История операций
          </h2>

          {!transactions || transactions.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-slate-400 text-sm">
                Операций пока нет
              </div>
              <div className="text-slate-400 text-xs mt-1">
                Если вы оплатили расход рейса из своих — офис начислит долг.
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
                        {t.type === 'accrual' ? 'Начислено' : 'Выплачено'}
                      </div>
                      {t.notes && (
                        <div className="text-xs text-slate-500 break-words mt-0.5">
                          {t.notes}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        {fmtDate(t.date)}
                        {t.original_amount && t.currency && t.currency !== 'EUR' && (
                          <> · {t.original_amount} {t.currency}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold whitespace-nowrap tabular-nums shrink-0 ${
                    t.type === 'accrual' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {t.type === 'accrual' ? '+' : '−'}{Number(t.amount_eur).toFixed(2)} €
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
