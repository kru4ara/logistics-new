'use client';

import { HandCoins, ArrowUpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';
import SubmitButton from '../../components/SubmitButton';
import { accrueDriverDebt, payOutDriverDebt, deleteDriverTransaction } from '../../driver-debts-actions';

export default function DriverFinance({
  driverId,
  transactions,
  accruedTotal,
  paidOutTotal,
  balance,
}: {
  driverId: string;
  transactions: any[];
  accruedTotal: number;
  paidOutTotal: number;
  balance: number;
}) {
  return (
    <div className="card p-5 md:p-6 space-y-5">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <HandCoins className="w-5 h-5 text-brand-600" strokeWidth={2} />
        Расчёты
      </h2>

      <div className={`rounded-2xl p-5 ${
        balance > 0
          ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
          : balance < 0
            ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
      }`}>
        <div className="text-sm text-white/80">
          {balance > 0 ? 'Компания должна водителю' : balance < 0 ? 'Водитель должен компании' : 'Долг закрыт'}
        </div>
        <div className="text-3xl font-bold mt-1 tabular-nums">
          {Math.abs(balance).toFixed(2)} €
        </div>
        <div className="flex gap-x-4 gap-y-1 mt-3 text-xs text-white/80 flex-wrap">
          <span>Начислено: <b className="text-white tabular-nums">{accruedTotal.toFixed(2)} €</b></span>
          <span>·</span>
          <span>Выплачено: <b className="text-white tabular-nums">{paidOutTotal.toFixed(2)} €</b></span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Погасить долг */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            <div className="text-sm font-bold text-slate-800">Погасить долг</div>
          </div>
          <p className="text-xs text-slate-500">
            Отметить, что офис выдал водителю деньги.
          </p>
          <form action={payOutDriverDebt} className="space-y-2">
            <input type="hidden" name="driver_id" value={driverId} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="amount" step="0.01" required placeholder="Сумма" className="input" />
              <select name="currency" className="input">
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="BYN">BYN</option>
              </select>
            </div>
            <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="input" />
            <input type="text" name="notes" placeholder="Комментарий (наличные / перевод / зачёт в ЗП)" className="input" />
            <SubmitButton
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
              pendingText="Сохраняю…"
            >
              <ArrowUpCircle className="w-4 h-4" strokeWidth={2.2} />
              Погасить
            </SubmitButton>
          </form>
        </div>

        {/* Начислить вручную */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
            <div className="text-sm font-bold text-slate-800">Начислить вручную</div>
          </div>
          <p className="text-xs text-slate-500">
            Внести долг без привязки к расходу рейса.
          </p>
          <form action={accrueDriverDebt} className="space-y-2">
            <input type="hidden" name="driver_id" value={driverId} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="amount" step="0.01" required placeholder="Сумма" className="input" />
              <select name="currency" className="input">
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="BYN">BYN</option>
              </select>
            </div>
            <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="input" />
            <input type="text" name="notes" placeholder="Комментарий (за что должны)" className="input" />
            <SubmitButton
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
              pendingText="Сохраняю…"
            >
              <ArrowDownCircle className="w-4 h-4" strokeWidth={2.2} />
              Начислить
            </SubmitButton>
          </form>
        </div>
      </div>

      {transactions && transactions.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
            История операций ({transactions.length})
          </div>
          <div className="space-y-1.5">
            {transactions.slice(0, 20).map((t: any) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {t.type === 'accrual' ? (
                    <ArrowDownCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
                  ) : (
                    <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.2} />
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
                      {t.date ? new Date(t.date).toLocaleDateString('ru-RU') : '—'}
                      {t.original_amount && t.currency && t.currency !== 'EUR' && (
                        <> · {t.original_amount} {t.currency}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`text-sm font-bold whitespace-nowrap tabular-nums ${
                    t.type === 'accrual' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {t.type === 'accrual' ? '+' : '−'}{Number(t.amount_eur).toFixed(2)} €
                  </div>
                  <form action={deleteDriverTransaction.bind(null, t.id, driverId)}>
                    <button
                      type="submit"
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      aria-label="Удалить операцию"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {transactions.length > 20 && (
              <div className="text-xs text-slate-400 text-center pt-2">
                Показаны последние 20 из {transactions.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
