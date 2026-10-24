import { Calendar, Truck, Package, Briefcase } from 'lucide-react';
import type { MonthData, YearTotals } from '../../lib/statistics';

export default function StatisticsTable({
  year,
  months,
  yearTotals,
  currentMonthKey,
  avgMargin,
  capexTotalForYear,
}: {
  year: number;
  months: MonthData[];
  yearTotals: YearTotals;
  currentMonthKey: string;
  avgMargin: number;
  capexTotalForYear: number;
}) {
  return (
    <div>
      <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
        По месяцам (операционная деятельность)
      </h2>

      {/* Mobile: карточки */}
      <div className="md:hidden space-y-3">
        {months.map((m) => {
          const isCurrentMonth = m.monthKey === currentMonthKey;
          const isFuture = m.monthKey > currentMonthKey;
          const isEmpty = m.tripsCount === 0 && m.forwardingCount === 0 && m.totalExpenses === 0;

          return (
            <div
              key={m.monthKey}
              className={`card p-4
                ${isCurrentMonth ? 'border-brand-300 bg-brand-50/40' :
                  isFuture ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`font-bold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                  {m.monthName}
                </span>
                {isCurrentMonth && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-600 text-white">
                    ТЕКУЩИЙ
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <Truck className="w-3 h-3" strokeWidth={2} />
                    Рейсов
                  </span>
                  <span className="font-semibold text-slate-700 tabular-nums">{m.tripsCount || '—'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Фрахт</span>
                  <span className="font-semibold text-green-600 break-words text-right tabular-nums">
                    {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <Package className="w-3 h-3" strokeWidth={2} />
                    Эксп.
                  </span>
                  <span className="font-semibold text-slate-700 tabular-nums">{m.forwardingCount || '—'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Доход эксп.</span>
                  <span className="font-semibold text-green-600 break-words text-right tabular-nums">
                    {m.forwardingClientSum > 0 ? `${m.forwardingClientSum.toFixed(0)} €` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Маржа эксп.</span>
                  <span className="font-semibold text-emerald-600 break-words text-right tabular-nums">
                    {m.forwardingMargin !== 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Прямые / Общие</span>
                  <span className="font-medium text-slate-600 break-words text-right tabular-nums">
                    {m.directExpenses.toFixed(0)} / {m.fixedExpenses.toFixed(0)} €
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Всего расходов</span>
                  <span className="font-semibold text-red-500 break-words text-right tabular-nums">
                    {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-800">Прибыль</span>
                  <span className={`font-bold text-base break-words text-right tabular-nums ${
                    isFuture ? 'text-slate-400' :
                    m.profit > 0 ? 'text-emerald-600' :
                    m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                  }`}>
                    {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Маржа</span>
                  <span className={`font-semibold text-right tabular-nums ${
                    isFuture ? 'text-slate-400' :
                    m.margin > 0 ? 'text-emerald-600' :
                    m.margin < 0 ? 'text-red-500' : 'text-slate-400'
                  }`}>
                    {m.totalIncome > 0 ? `${m.margin.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="bg-slate-100 rounded-2xl border-2 border-slate-200 p-4">
          <div className="font-bold text-slate-900 mb-3">ИТОГО за {year}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600 inline-flex items-center gap-1">
                <Truck className="w-3 h-3" strokeWidth={2} />
                Рейсов
              </span>
              <span className="font-bold text-slate-900 tabular-nums">{yearTotals.tripsCount}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">Фрахт</span>
              <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600 inline-flex items-center gap-1">
                <Package className="w-3 h-3" strokeWidth={2} />
                Эксп.
              </span>
              <span className="font-bold text-slate-900 tabular-nums">{yearTotals.forwardingCount}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">Доход эксп.</span>
              <span className="font-bold text-green-600 break-words text-right tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">Маржа эксп.</span>
              <span className="font-bold text-emerald-600 break-words text-right tabular-nums">{yearTotals.forwardingMargin.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">Всего расходов</span>
              <span className="font-bold text-red-500 break-words text-right tabular-nums">{yearTotals.totalExpenses.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-300">
              <span className="font-bold text-slate-800">Прибыль</span>
              <span className={`font-bold text-lg break-words text-right tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearTotals.profit.toFixed(0)} €
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600">Маржа</span>
              <span className={`font-bold text-right tabular-nums ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {avgMargin.toFixed(1)}%
              </span>
            </div>
            {capexTotalForYear > 0 && (
              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-300">
                <span className="text-slate-500 text-[10px] uppercase inline-flex items-center gap-1">
                  <Briefcase className="w-3 h-3" strokeWidth={2} />
                  Инвестиции (вне P&L)
                </span>
                <span className="font-bold text-amber-600 break-words text-right tabular-nums">
                  {capexTotalForYear.toFixed(0)} €
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: таблица */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Месяц</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Эксп.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Доход эксп.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа эксп.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прямые</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Общие</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Всего расходов</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const isCurrentMonth = m.monthKey === currentMonthKey;
                const isFuture = m.monthKey > currentMonthKey;
                const isEmpty = m.tripsCount === 0 && m.forwardingCount === 0 && m.totalExpenses === 0;

                return (
                  <tr
                    key={m.monthKey}
                    className={`border-b border-slate-50 transition-colors
                      ${isCurrentMonth ? 'bg-brand-50/50' :
                        isFuture ? 'bg-slate-50/30 text-slate-400' :
                        'hover:bg-brand-50/30'}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold capitalize ${isFuture ? 'text-slate-400' : 'text-slate-800'}`}>
                          {m.monthName}
                        </span>
                        {isCurrentMonth && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white">
                            ТЕКУЩИЙ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-center font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                      {m.tripsCount > 0 ? m.tripsCount : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-green-600'}`}>
                      {m.tripRevenue > 0 ? `${m.tripRevenue.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-center font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-700'}`}>
                      {m.forwardingCount > 0 ? m.forwardingCount : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-green-600'}`}>
                      {m.forwardingClientSum > 0 ? `${m.forwardingClientSum.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isFuture ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {m.forwardingMargin !== 0 ? `${m.forwardingMargin.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                      {m.directExpenses > 0 ? `${m.directExpenses.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right tabular-nums ${isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                      {m.fixedExpenses > 0 ? `${m.fixedExpenses.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-medium tabular-nums ${isFuture ? 'text-slate-400' : 'text-red-500'}`}>
                      {m.totalExpenses > 0 ? `${m.totalExpenses.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${
                      isFuture ? 'text-slate-400' :
                      m.profit > 0 ? 'text-emerald-600' :
                      m.profit < 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {!isEmpty ? `${m.profit.toFixed(0)} €` : '—'}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${
                      isFuture ? 'text-slate-400' :
                      m.margin > 0 ? 'text-emerald-600' :
                      m.margin < 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {m.totalIncome > 0 ? `${m.margin.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-200">
                <td className="px-4 py-4 font-bold text-slate-900">ИТОГО за {year}</td>
                <td className="px-4 py-4 text-center font-bold text-slate-900 tabular-nums">{yearTotals.tripsCount}</td>
                <td className="px-4 py-4 text-right font-bold text-green-600 tabular-nums">{yearTotals.tripRevenue.toFixed(0)} €</td>
                <td className="px-4 py-4 text-center font-bold text-slate-900 tabular-nums">{yearTotals.forwardingCount}</td>
                <td className="px-4 py-4 text-right font-bold text-green-600 tabular-nums">{yearTotals.forwardingClientSum.toFixed(0)} €</td>
                <td className="px-4 py-4 text-right font-bold text-emerald-600 tabular-nums">{yearTotals.forwardingMargin.toFixed(0)} €</td>
                <td className="px-4 py-4 text-right font-bold text-slate-700 tabular-nums">{yearTotals.directExpenses.toFixed(0)} €</td>
                <td className="px-4 py-4 text-right font-bold text-slate-700 tabular-nums">{yearTotals.fixedExpenses.toFixed(0)} €</td>
                <td className="px-4 py-4 text-right font-bold text-red-500 tabular-nums">{yearTotals.totalExpenses.toFixed(0)} €</td>
                <td className={`px-4 py-4 text-right font-bold text-lg tabular-nums ${yearTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {yearTotals.profit.toFixed(0)} €
                </td>
                <td className={`px-4 py-4 text-right font-bold tabular-nums ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {avgMargin.toFixed(1)}%
                </td>
              </tr>
              {capexTotalForYear > 0 && (
                <tr className="bg-amber-50/50 border-t border-amber-200">
                  <td colSpan={9} className="px-4 py-3 text-right font-semibold text-amber-700 text-sm inline-flex items-center justify-end gap-1.5 w-full">
                    <Briefcase className="w-3.5 h-3.5" strokeWidth={2} />
                    Инвестиции за год (вне P&L):
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-amber-600 text-base tabular-nums">
                    {capexTotalForYear.toFixed(0)} €
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
