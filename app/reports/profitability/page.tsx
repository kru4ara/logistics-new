import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Coins,
  Handshake,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name || '';
  }
  return '';
}

function pickTruck(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.registration_number || '';
  if (typeof rel === 'object' && 'registration_number' in rel) {
    return (rel as { registration_number?: string }).registration_number || '';
  }
  return '';
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function firstDayOfYearIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type ClientRow = {
  name: string;
  type: 'Рейсы' | 'Экспедирование';
  count: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

type TruckRow = {
  id: string;
  registration: string;
  count: number;
  km: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const from = searchParams.from || firstDayOfYearIso();
  const to = searchParams.to || todayIso();

  const supabase = await createClient();

  // РЕЙСЫ + РАСХОДЫ
  const { data: trips } = await supabase
    .from('trips')
    .select(`
      id, client_id, truck_id, revenue_eur, actual_km, start_date,
      clients(name),
      trucks!truck_id(registration_number)
    `)
    .gte('start_date', from)
    .lte('start_date', to);

  const tripIds = (trips || []).map((t: any) => t.id).filter(Boolean);

  const expensesByTrip: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: exp } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', tripIds);
    (exp || []).forEach((e: any) => {
      if (!e.trip_id) return;
      expensesByTrip[e.trip_id] = (expensesByTrip[e.trip_id] || 0) + toNum(e.amount_eur);
    });
  }

  // ЭКСПЕДИРОВАНИЕ
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_id, client_price_eur, load_date, clients(name)')
    .gte('load_date', from)
    .lte('load_date', to);

  const fwdIds = (forwarding || []).map((f: any) => f.id).filter(Boolean);

  const contractorsByFwd: Record<string, number> = {};
  const expensesByFwd: Record<string, number> = {};

  if (fwdIds.length > 0) {
    const [{ data: fc }, { data: fe }] = await Promise.all([
      supabase
        .from('forwarding_contractors')
        .select('forwarding_id, price_eur')
        .in('forwarding_id', fwdIds),
      supabase
        .from('forwarding_expenses')
        .select('forwarding_id, amount_eur')
        .in('forwarding_id', fwdIds),
    ]);

    (fc || []).forEach((c: any) => {
      if (!c.forwarding_id) return;
      contractorsByFwd[c.forwarding_id] =
        (contractorsByFwd[c.forwarding_id] || 0) + toNum(c.price_eur);
    });
    (fe || []).forEach((e: any) => {
      if (!e.forwarding_id) return;
      expensesByFwd[e.forwarding_id] =
        (expensesByFwd[e.forwarding_id] || 0) + toNum(e.amount_eur);
    });
  }

  // АГРЕГАЦИЯ ПО КЛИЕНТАМ
  const clientRows: ClientRow[] = [];

  const byClientTrips: Record<string, { name: string; count: number; revenue: number; expenses: number }> = {};
  for (const t of trips || []) {
    const name = pickName((t as any).clients);
    if (!name) continue;
    if (!byClientTrips[name]) byClientTrips[name] = { name, count: 0, revenue: 0, expenses: 0 };
    byClientTrips[name].count += 1;
    byClientTrips[name].revenue += toNum((t as any).revenue_eur);
    byClientTrips[name].expenses += expensesByTrip[(t as any).id] || 0;
  }
  for (const r of Object.values(byClientTrips)) {
    const profit = r.revenue - r.expenses;
    const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
    clientRows.push({
      name: r.name,
      type: 'Рейсы',
      count: r.count,
      revenue: r.revenue,
      expenses: r.expenses,
      profit,
      margin,
    });
  }

  const byClientFwd: Record<string, { name: string; count: number; revenue: number; expenses: number }> = {};
  for (const f of forwarding || []) {
    const name = pickName((f as any).clients);
    if (!name) continue;
    if (!byClientFwd[name]) byClientFwd[name] = { name, count: 0, revenue: 0, expenses: 0 };
    byClientFwd[name].count += 1;
    byClientFwd[name].revenue += toNum((f as any).client_price_eur);
    byClientFwd[name].expenses +=
      (contractorsByFwd[(f as any).id] || 0) + (expensesByFwd[(f as any).id] || 0);
  }
  for (const r of Object.values(byClientFwd)) {
    const profit = r.revenue - r.expenses;
    const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
    clientRows.push({
      name: r.name,
      type: 'Экспедирование',
      count: r.count,
      revenue: r.revenue,
      expenses: r.expenses,
      profit,
      margin,
    });
  }

  clientRows.sort((a, b) => b.profit - a.profit);

  // АГРЕГАЦИЯ ПО МАШИНАМ
  const byTruck: Record<
    string,
    { id: string; registration: string; count: number; km: number; revenue: number; expenses: number }
  > = {};

  for (const t of trips || []) {
    const truckId = (t as any).truck_id;
    if (!truckId) continue;
    const registration = pickTruck((t as any).trucks) || '—';

    if (!byTruck[truckId]) {
      byTruck[truckId] = {
        id: truckId,
        registration,
        count: 0,
        km: 0,
        revenue: 0,
        expenses: 0,
      };
    }
    byTruck[truckId].count += 1;
    byTruck[truckId].km += toNum((t as any).actual_km);
    byTruck[truckId].revenue += toNum((t as any).revenue_eur);
    byTruck[truckId].expenses += expensesByTrip[(t as any).id] || 0;
  }

  const truckRows: TruckRow[] = Object.values(byTruck).map((t) => {
    const profit = t.revenue - t.expenses;
    const margin = t.revenue > 0 ? (profit / t.revenue) * 100 : 0;
    return { ...t, profit, margin };
  });
  truckRows.sort((a, b) => b.profit - a.profit);

  // ИТОГИ
  const totalRevenue = clientRows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = clientRows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Отчёты
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-7 h-7 text-brand-600" />
            Прибыльность
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Кто из клиентов и какая техника приносят деньги
          </p>
        </div>

        {/* Фильтр по периоду */}
        <form
          className="card p-4 md:p-5"
          method="GET"
        >
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className={labelClass}>С даты</label>
              <input type="date" name="from" defaultValue={from} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>По дату</label>
              <input type="date" name="to" defaultValue={to} className={inputClass} />
            </div>
            <div className="col-span-2 md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98]"
              >
                Показать
              </button>
              <a
                href="/reports/profitability"
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-all whitespace-nowrap"
              >
                Сброс
              </a>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Рейсы — по дате старта, экспедирование — по дате загрузки.
          </div>
        </form>

        {/* Общие итоги */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-4">
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Сделок</div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600">
              {clientRows.reduce((s, r) => s + r.count, 0)}
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Доход</div>
            <div className="text-xl md:text-2xl font-bold text-green-600 break-words">
              {fmt(totalRevenue)} €
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Расходы</div>
            <div className="text-xl md:text-2xl font-bold text-red-500 break-words">
              {fmt(totalExpenses)} €
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Прибыль / маржа</div>
            <div className={`text-xl md:text-2xl font-bold break-words ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(totalProfit)} €
            </div>
            <div className="text-xs text-slate-400 mt-1">маржа {fmtPct(totalMargin)}</div>
          </div>
        </div>

        {/* ПРИБЫЛЬНОСТЬ КЛИЕНТОВ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Handshake className="w-5 h-5 text-brand-600" />
            Прибыльность клиентов
          </h2>

          {clientRows.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              Нет данных за выбранный период
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {clientRows.map((r, i) => (
                  <div
                    key={`${r.name}-${r.type}-${i}`}
                    className="card p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm break-words">
                          {r.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {r.type} · {r.count} сделок
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold text-sm whitespace-nowrap ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(r.profit)} €
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400">Доход</div>
                        <div className="font-semibold text-green-600">{fmt(r.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Расходы</div>
                        <div className="font-semibold text-red-500">{fmt(r.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Маржа</div>
                        <div className={`font-semibold ${r.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(r.margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Клиент</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тип</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Сделок</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Доход</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientRows.map((r, i) => (
                        <tr key={`${r.name}-${r.type}-${i}`} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 break-words">
                            {r.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'Рейсы' ? 'bg-brand-50 text-brand-700' : 'bg-purple-50 text-purple-700'}`}>
                              {r.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">{r.count}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                            {fmt(r.revenue)} €
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-500 whitespace-nowrap">
                            {fmt(r.expenses)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold whitespace-nowrap ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(r.profit)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap ${r.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(r.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ПРИБЫЛЬНОСТЬ МАШИН */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" />
            Прибыльность тягачей (по рейсам)
          </h2>

          {truckRows.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              Нет данных за выбранный период
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {truckRows.map((t) => (
                  <div key={t.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">
                          {t.registration}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {t.count} рейсов · {fmt(t.km)} км
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold text-sm whitespace-nowrap ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(t.profit)} €
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400">Фрахт</div>
                        <div className="font-semibold text-green-600">{fmt(t.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Расходы</div>
                        <div className="font-semibold text-red-500">{fmt(t.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Маржа</div>
                        <div className={`font-semibold ${t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(t.margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тягач</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пробег, км</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {truckRows.map((t) => (
                        <tr key={t.id} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.registration}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">{t.count}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap">{fmt(t.km)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                            {fmt(t.revenue)} €
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-500 whitespace-nowrap">
                            {fmt(t.expenses)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold whitespace-nowrap ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(t.profit)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap ${t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(t.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
