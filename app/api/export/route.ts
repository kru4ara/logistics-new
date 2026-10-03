import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { cookies } from 'next/headers';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// ============================================================
// Утилиты
// ============================================================
function isoDate(d: string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return '';
  }
}

function pickName(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name || '';
  }
  return '';
}

function toNumber(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// ============================================================
// РЕЙСЫ
// ============================================================
async function buildTripsSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<XLSX.WorkSheet> {
  let query = supabase
    .from('trips')
    .select(`
      trip_number, start_date, end_date, route, status, revenue_eur, actual_km,
      clients(name),
      drivers!driver_id(first_name, last_name),
      trucks!truck_id(registration_number)
    `)
    .order('trip_number', { ascending: true });

  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data: trips } = await query;

  const tripIds = (trips || []).map((t) => (t as any).id).filter(Boolean) as string[];

  // Расходы одним запросом
  const expensesByTrip: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: exp } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur');
    (exp || []).forEach((e) => {
      if (!e.trip_id) return;
      expensesByTrip[e.trip_id] = (expensesByTrip[e.trip_id] || 0) + toNumber(e.amount_eur);
    });
  }

  // Нужны id — приходится тянуть отдельно, потому что select их не включил
  let query2 = supabase
    .from('trips')
    .select(`
      id, trip_number, start_date, end_date, route, status, revenue_eur, actual_km,
      clients(name),
      drivers!driver_id(first_name, last_name),
      trucks!truck_id(registration_number)
    `)
    .order('trip_number', { ascending: true });

  if (from) query2 = query2.gte('start_date', from);
  if (to) query2 = query2.lte('start_date', to);

  const { data: tripsFull } = await query2;

  const rows = (tripsFull || []).map((t: any) => {
    const exp = expensesByTrip[t.id] || 0;
    const revenue = toNumber(t.revenue_eur);
    const driver = t.drivers
      ? `${t.drivers.first_name || ''} ${t.drivers.last_name || ''}`.trim()
      : '';
    return {
      '№ рейса': t.trip_number || '',
      'Старт': isoDate(t.start_date),
      'Финиш': isoDate(t.end_date),
      'Клиент': pickName(t.clients),
      'Тягач': t.trucks?.registration_number || '',
      'Водитель': driver,
      'Маршрут': t.route || '',
      'Фрахт (EUR)': revenue,
      'Расходы (EUR)': exp,
      'Прибыль (EUR)': revenue - exp,
      'Пробег (км)': toNumber(t.actual_km),
      'Статус': t.status || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
    { wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 14 },
  ];
  return ws;
}

// ============================================================
// РАСХОДЫ ПО РЕЙСАМ
// ============================================================
async function buildExpensesSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<XLSX.WorkSheet> {
  let query = supabase
    .from('trip_expenses')
    .select(`
      expense_date, category, description, original_amount, currency, amount_eur, liters,
      trips(trip_number)
    `)
    .order('expense_date', { ascending: false });

  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);

  const { data } = await query;

  const rows = (data || []).map((e: any) => ({
    'Дата': isoDate(e.expense_date),
    'Рейс №': e.trips?.trip_number || '',
    'Категория': e.category || '',
    'Описание': e.description || '',
    'Сумма': toNumber(e.original_amount),
    'Валюта': e.currency || '',
    'В EUR': toNumber(e.amount_eur),
    'Литры': e.liters != null ? toNumber(e.liters) : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 40 },
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
  ];
  return ws;
}

// ============================================================
// ЭКСПЕДИРОВАНИЕ
// ============================================================
async function buildForwardingSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<XLSX.WorkSheet> {
  let query = supabase
    .from('forwarding_orders')
    .select(`
      order_number, load_date, unload_date, status,
      client_price_eur, original_client_price, original_currency,
      clients(name)
    `)
    .order('order_number', { ascending: true });

  if (from) query = query.gte('load_date', from);
  if (to) query = query.lte('load_date', to);

  const { data: orders } = await query;
  const ids = (orders || []).map((o: any) => o.id).filter(Boolean) as string[];

  // Подрядчики
  const contractorsByFwd: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: fc } = await supabase
      .from('forwarding_contractors')
      .select('forwarding_id, price_eur');
    (fc || []).forEach((c: any) => {
      if (!c.forwarding_id) return;
      contractorsByFwd[c.forwarding_id] = (contractorsByFwd[c.forwarding_id] || 0) + toNumber(c.price_eur);
    });
  }

  // Доп. расходы
  const expensesByFwd: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: fe } = await supabase
      .from('forwarding_expenses')
      .select('forwarding_id, amount_eur');
    (fe || []).forEach((e: any) => {
      if (!e.forwarding_id) return;
      expensesByFwd[e.forwarding_id] = (expensesByFwd[e.forwarding_id] || 0) + toNumber(e.amount_eur);
    });
  }

  // Ещё раз тянуть с id
  let query2 = supabase
    .from('forwarding_orders')
    .select(`
      id, order_number, load_date, unload_date, status,
      client_price_eur, original_client_price, original_currency,
      clients(name)
    `)
    .order('order_number', { ascending: true });

  if (from) query2 = query2.gte('load_date', from);
  if (to) query2 = query2.lte('load_date', to);

  const { data: ordersFull } = await query2;

  const rows = (ordersFull || []).map((o: any) => {
    const clientPrice = toNumber(o.client_price_eur);
    const cSum = contractorsByFwd[o.id] || 0;
    const eSum = expensesByFwd[o.id] || 0;
    return {
      '№ заявки': o.order_number || '',
      'Дата загрузки': isoDate(o.load_date),
      'Дата выгрузки': isoDate(o.unload_date),
      'Клиент': pickName(o.clients),
      'Клиент платит (EUR)': clientPrice,
      'Подрядчикам (EUR)': cSum,
      'Доп. расходы (EUR)': eSum,
      'Маржа (EUR)': clientPrice - cSum - eSum,
      'Статус': o.status || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
  ];
  return ws;
}

// ============================================================
// ПРИБЫЛЬНОСТЬ КЛИЕНТОВ (сводная)
// ============================================================
async function buildClientsSheet(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<XLSX.WorkSheet> {
  const [{ data: trips }, { data: forwarding }] = await Promise.all([
    supabase
      .from('trips')
      .select('revenue_eur, clients(name)'),
    supabase
      .from('forwarding_orders')
      .select('client_price_eur, clients(name)'),
  ]);

  const stats: Record<string, { name: string; revenue: number; count: number; type: string }> = {};

  (trips || []).forEach((t: any) => {
    const name = pickName(t.clients);
    if (!name) return;
    const key = `trip-${name}`;
    if (!stats[key]) stats[key] = { name, revenue: 0, count: 0, type: 'Рейсы' };
    stats[key].revenue += toNumber(t.revenue_eur);
    stats[key].count += 1;
  });

  (forwarding || []).forEach((f: any) => {
    const name = pickName(f.clients);
    if (!name) return;
    const key = `fwd-${name}`;
    if (!stats[key]) stats[key] = { name, revenue: 0, count: 0, type: 'Экспедирование' };
    stats[key].revenue += toNumber(f.client_price_eur);
    stats[key].count += 1;
  });

  const rows = Object.values(stats)
    .sort((a, b) => b.revenue - a.revenue)
    .map((s) => ({
      'Клиент': s.name,
      'Тип': s.type,
      'Сделок': s.count,
      'Доход (EUR)': s.revenue,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 35 }, { wch: 16 }, { wch: 10 }, { wch: 16 }];
  return ws;
}

// ============================================================
// GET
// ============================================================
export async function GET(request: Request) {
  const role = cookies().get('role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'trips';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = await createClient();

  let sheet: XLSX.WorkSheet;
  let sheetName: string;
  let fileName: string;

  try {
    if (type === 'trips') {
      sheet = await buildTripsSheet(supabase, from, to);
      sheetName = 'Рейсы';
      fileName = `Trips_${from || 'all'}_${to || 'all'}.xlsx`;
    } else if (type === 'expenses') {
      sheet = await buildExpensesSheet(supabase, from, to);
      sheetName = 'Расходы рейсов';
      fileName = `Expenses_${from || 'all'}_${to || 'all'}.xlsx`;
    } else if (type === 'forwarding') {
      sheet = await buildForwardingSheet(supabase, from, to);
      sheetName = 'Экспедирование';
      fileName = `Forwarding_${from || 'all'}_${to || 'all'}.xlsx`;
    } else if (type === 'clients') {
      sheet = await buildClientsSheet(supabase);
      sheetName = 'Прибыльность клиентов';
      fileName = `Clients_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error('[export] error:', e);
    return NextResponse.json(
      { error: (e as Error).message || 'Ошибка генерации' },
      { status: 500 }
    );
  }
}
