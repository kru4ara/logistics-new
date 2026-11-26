import Link from 'next/link';
import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/admin';
import { Package, ArrowLeft, Inbox } from 'lucide-react';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import { deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { INTL_LOCALE } from '../../../lib/i18n/config';
import { formatEur } from '../../../lib/i18n/format';

export const dynamic = 'force-dynamic';

export default async function CargoReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; client?: string }>;
}) {
  const { t, locale } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'reports.viewAll');
  if (denied) redirect(denied);

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
      trip_id, trips!inner(id, trip_number, start_date, status, revenue_eur)
    `);

  if (from) query = query.gte('trips.start_date', from);
  if (to) query = query.lte('trips.start_date', to);
  if (clientId) query = query.eq('client_id', clientId);

  const { data: cargoRows, error } = await fetchAll(query);
  if (error) {
    return <div className="p-8 text-red-500">{t('dir.error')}{' '}{error.message}</div>;
  }

  // 2. Считаем расходы по рейсам
  const tripIds = Array.from(new Set((cargoRows || []).map((c: any) => c.trip_id)));
  const expensesByTrip: Record<string, number> = {};

  if (tripIds.length > 0) {
    const { data: expenses } = await fetchAllByIds(tripIds, (chunk) => supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', chunk));

    (expenses || []).forEach((e: any) => {
      if (!e.trip_id) return;
      expensesByTrip[e.trip_id] = (expensesByTrip[e.trip_id] || 0) + (e.amount_eur || 0);
    });
  }

  // 3. Группируем грузы по рейсу
  const cargoByTrip: Record<string, any[]> = {};
  (cargoRows || []).forEach((c: any) => {
    if (!cargoByTrip[c.trip_id]) cargoByTrip[c.trip_id] = [];
    cargoByTrip[c.trip_id].push(c);
  });

  const reportRows = (cargoRows || [])
    .filter((c: any) => c.trips && c.trips.trip_number) // убираем грузы без рейса
    .map((c: any) => {
      const trip = c.trips;
      const tripCargo = cargoByTrip[c.trip_id] || [];
      const tripExpenses = expensesByTrip[c.trip_id] || 0;

      // ЛОГИКА ФРАХТА: если у груза нет своего, берём из рейса
      let freight = c.freight_amount || 0;
      const isFallback = freight === 0 && (trip.revenue_eur || 0) > 0;

      if (isFallback) {
        freight = (trip.revenue_eur || 0) / (tripCargo.length || 1);
      }

      const totalTripFreight = tripCargo.reduce((sum, item) => {
        return sum + (item.freight_amount || (isFallback ? freight : 0));
      }, 0);

      const share = totalTripFreight > 0 ? freight / totalTripFreight : (1 / (tripCargo.length || 1));
      const allocatedExpenses = tripExpenses * share;
      const profit = freight - allocatedExpenses;

      return {
        id: c.id,
        tripId: c.trip_id,
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
        isFallback,
      };
    });

  // Сортируем: сначала новые рейсы, потом по номеру рейса (по убыванию)
  reportRows.sort((a, b) => {
    const dateA = a.tripDate ? new Date(a.tripDate).getTime() : 0;
    const dateB = b.tripDate ? new Date(b.tripDate).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;

    const numA = a.tripNumber === '—' ? 0 : Number(a.tripNumber);
    const numB = b.tripNumber === '—' ? 0 : Number(b.tripNumber);
    return numB - numA;
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
          <ArrowLeft className="w-4 h-4" />{' '}{t('rep.allReportsS')}
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-600" />
            {t('rep.qCargo')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {t('rep.cgHint')}{' '}<br/>
            <span className="text-xs text-slate-400">{t('rep.cgNote')}</span>
          </p>
        </div>

        {/* Фильтры */}
        <form className="card p-4 md:p-5" method="GET">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('rep.dateFrom')}</label>
              <input type="date" name="from" defaultValue={from} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('rep.dateTo')}</label>
              <input type="date" name="to" defaultValue={to} className="input" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('trips.filterClient')}</label>
              <select name="client" defaultValue={clientId} className="input">
                <option value="">{t('rep.allClients')}</option>
                {(clientsList || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="mt-3 btn btn-primary text-sm">{t('rep.show')}</button>
        </form>

        {/* Итоги */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">{t('drvCard.totalFreight')}</div>
            <div className="text-2xl font-bold text-green-600 tabular-nums">{formatEur(totalFreight)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">{t('rep.cgAlloc')}</div>
            <div className="text-2xl font-bold text-red-500 tabular-nums">{formatEur(totalExpenses)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500 mb-1">{t('trips.profit')}</div>
            <div className={`text-2xl font-bold tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatEur(totalProfit)}
            </div>
          </div>
        </div>

        {/* Таблица */}
        <div className="card overflow-hidden">
          {reportRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {t('rep.cgNone')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('trips.kindTrip')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('addr.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('trips.filterClient')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('tripForm.cargo')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('rep.cgWeight')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('trips.freight')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('trips.expenses')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('trips.profit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium tabular-nums">
                        <Link href={`/trips/${r.tripId}`} className="text-brand-600 hover:underline">
                          № {r.tripNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
                        {r.tripDate ? new Date(r.tripDate).toLocaleDateString(INTL_LOCALE[locale]) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{r.clientName}</td>
                      <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={r.cargoLabel}>
                        {r.cargoLabel}
                        {r.isFallback && <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200" title={t('rep.cgFromTrip')}>*</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                        {r.weight ? `${r.weight} ${t('units.kg')}` : '—'} / {r.pallets ? `${r.pallets} ${t('units.pal')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">
                        {formatEur(r.freight, 2)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 tabular-nums">
                        {formatEur(r.expenses, 2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatEur(r.profit, 2)}
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
