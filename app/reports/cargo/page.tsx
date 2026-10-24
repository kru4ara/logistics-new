import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import { Package, ArrowLeft, TrendingUp, Wallet, Filter, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CargoReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; client?: string }>;
}) {
  const role = (await cookies()).get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const resolvedParams = await searchParams;
  const from = resolvedParams.from || '';
  const to = resolvedParams.to || '';
  const clientId = resolvedParams.client || '';

  const supabase = await createClient();

  // 1. Получаем грузы с рейсами
  let query = supabase
    .from('trip_cargo')
    .select(`
      id, label, cargo_type, weight_kg, pallets,
      freight_amount, freight_currency,
      client_id, clients(name),
      trip_id, trips!inner(id, trip_number, start_date, status)
    `)
    .order('id', { ascending: false });

  if (from) query = query.gte('trips.start_date', from);
  if (to) query = query.lte('trips.start_date', to);
  if (clientId) query = query.eq('client_id', clientId);

  const { data: cargoRows, error } = await query;
  if (error) {
    return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;
  }

  // 2. Считаем расходы по рейсам (для распределения)
  const tripIds = Array.from(new Set((cargoRows || []).map((c: any) => c.trip_id)));
  const expensesByTrip: Record<string, number> = {};

  if (tripIds.length > 0) {
    const { data: expenses } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', tripIds);

    (expenses || []).forEach((e: any) => {
      if (!e.trip_id) return;
      expensesByTrip[e.trip_id] = (expensesByTrip[e.trip_id] || 0) + (e.amount_eur || 0);
    });
  }

  // 3. Группируем грузы по рейсу, чтобы распределить расходы пропорционально фрахту
  const cargoByTrip: Record<string, any[]> = {};
  (cargoRows || []).forEach((c: any) => {
    if (!cargoByTrip[c.trip_id]) cargoByTrip[c.trip_id] = [];
    cargoByTrip[c.trip_id].push(c);
  });

  const reportRows = (cargoRows || []).map((c: any) => {
    const trip = c.trips;
    const tripCargo = cargoByTrip[c.trip_id] || [];
    
    // Общий фрахт рейса (в EUR) — для пропорции
    const totalTripFreight = tripCargo.reduce((sum, item) => {
      // Упрощение: считаем, что все фрахты в EUR (или уже пересчитаны)
      return sum + (item.freight_amount || 0);
    }, 0);

    const tripExpenses = expensesByTrip[c.trip_id] || 0;
    
    // Доля расходов, приходящаяся на этот груз
    const share = totalTripFreight > 0 ? (c.freight_amount || 0) / totalTripFreight : 0;
    const allocatedExpenses = tripExpenses * share;

    const freight = c.freight_amount || 0;
    const profit = freight - allocatedExpenses;

    return {
      id: c.id,
      tripNumber: trip?.trip_number || '—',
      tripDate: trip?.start_date,
      clientName: c.clients?.name || '—',
      cargoLabel: c.label || '—',
      weight: c.weight_kg,
      pallets: c.pallets,
      freight: freight,
      freightCurrency: c.freight_currency || 'EUR',
      expenses: allocatedExpenses,
      profit: profit,
    };
  });

  // 4. Итоги
  const totalFreight = reportRows.reduce((s, r) => s + r.freight, 0);
  const totalExpenses = reportRows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalFreight - totalExpenses;

  // 5. Клиенты для фильтра
  const { data: clientsList } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Все отчёты
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-600" />
            Фрахт по грузам
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Прибыльность каждого груза (расходы распределены пропорционально)</p>
        </div>

        {/* Фильтры */}
        <form className="card p-4 md:p-5" method="GET">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">С даты</label>
              <input type="date" name="from" defaultValue={from} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">По дату</label>
              <input type="date" name="to" defaultValue={to} className="input" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Клиент</label>
              <select name="client" defaultValue={clientId} className="input">
                <option value="">— Все клиенты —</option>
                {(clientsList || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="mt-3 btn btn-primary text-sm">Показать</button>
        </form>

        {/* Итоги */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Общий фрахт</div>
            <div className="text-2xl font-bold text-green-600 tabular-nums">{totalFreight.toFixed(0)} €</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Расходы (распределённые)</div>
            <div className="text-2xl font-bold text-red-500 tabular-nums">{totalExpenses.toFixed(0)} €</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">Прибыль</div>
            <div className={`text-2xl font-bold tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalProfit.toFixed(0)} €
            </div>
          </div>
        </div>

        {/* Таблица */}
        <div className="card overflow-hidden">
          {reportRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Нет грузов за выбранный период
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Рейс</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Клиент</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Груз</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Вес / Паллеты</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Фрахт</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Расходы</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium tabular-nums">
                        <Link href={`/trips/${r.id}`} className="text-brand-600 hover:underline">
                          № {r.tripNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
                        {r.tripDate ? new Date(r.tripDate).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{r.clientName}</td>
                      <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={r.cargoLabel}>
                        {r.cargoLabel}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                        {r.weight ? `${r.weight} кг` : '—'} / {r.pallets ? `${r.pallets} пал.` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">
                        {r.freight.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 tabular-nums">
                        {r.expenses.toFixed(2)} €
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {r.profit.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
