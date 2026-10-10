import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { cookies } from 'next/headers';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// ============================================================
// Словари
// ============================================================
const STATUS_LABELS: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Топливо',
  epi: 'EPI',
  etoll: 'e-TOLL',
  border: 'Граница',
  salary: 'ЗП водителя',
  contractor: 'Подрядчик',
  permit: 'Дозвол',
  tlc: 'ТЛЦ',
  waiting: 'Зона ожидания',
  repair: 'Ремонт',
  parking: 'Паркинг',
  disinfection: 'Дезинфекция',
  ex1: 'ЕХ-1',
  otkat: 'Откат',
  gps_seal: 'GPS пломба',
  other: 'Другое',
};

function statusLabel(s: string | null | undefined): string {
  if (!s) return '';
  return STATUS_LABELS[s] || s;
}

function categoryLabel(c: string | null | undefined): string {
  if (!c) return '';
  return CATEGORY_LABELS[c] || c;
}

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

function r2(n: number): number {
  return Math.round(n * 100) / 100;
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
      id, trip_number, start_date, end_date, route, status, revenue_eur, actual_km,
      clients(name),
      drivers!driver_id(first_name, last_name),
      trucks!truck_id(registration_number)
    `)
    .order('trip_number', { ascending: true });

  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data: trips, error } = await query;
  if (error) console.error('[export/trips] trips error:', error);

  const tripIds = (trips || []).map((t: any) => t.id).filter(Boolean) as string[];

  const expensesByTrip: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: exp, error: expErr } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', tripIds);
    if (expErr) console.error('[export/trips] expenses error:', expErr);
    (exp || []).forEach((e: any) => {
      if (!e.trip_id) return;
      expensesByTrip[e.trip_id] = (expensesByTrip[e.trip_id] || 0) + toNumber(e.amount_eur);
    });
  }

  const rows: Record<string, unknown>[] = (trips || []).map((t: any) => {
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
      'Фрахт (EUR)': r2(revenue),
      'Расходы (EUR)': r2(exp),
      'Прибыль (EUR)': r2(revenue - exp),
      'Пробег (км)': toNumber(t.actual_km),
      'Статус': statusLabel(t.status),
    };
  });

  // Итоговая строка
  const totalRevenue = rows.reduce((s, r) => s + (r['Фрахт (EUR)'] as number || 0), 0);
  const totalExpenses = rows.reduce((s, r) => s + (r['Расходы (EUR)'] as number || 0), 0);
  const totalKm = rows.reduce((s, r) => s + (r['Пробег (км)'] as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      '№ рейса': 'ИТОГО',
      'Старт': '',
      'Финиш': '',
      'Клиент': '',
      'Тягач': '',
      'Водитель': '',
      'Маршрут': '',
      'Фрахт (EUR)': r2(totalRevenue),
      'Расходы (EUR)': r2(totalExpenses),
      'Прибыль (EUR)': r2(totalRevenue - totalExpenses),
      'Пробег (км)': r2(totalKm),
      'Статус': '',
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
    { wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 16 },
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

  const { data, error } = await query;
  if (error) console.error('[export/expenses] error:', error);

  const rows: Record<string, unknown>[] = (data || []).map((e: any) => ({
    'Дата': isoDate(e.expense_date),
    'Рейс №': e.trips?.trip_number || '',
    'Категория': categoryLabel(e.category),
    'Описание': e.description || '',
    'Сумма': toNumber(e.original_amount),
    'Валюта': e.currency || '',
    'В EUR': r2(toNumber(e.amount_eur)),
    'Литры': e.liters != null ? toNumber(e.liters) : '',
  }));

  const totalEur = rows.reduce((s, r) => s + (r['В EUR'] as number || 0), 0);
  const totalLiters = rows.reduce((s, r) => s + (typeof r['Литры'] === 'number' ? r['Литры'] : 0), 0);

  if (rows.length > 0) {
    rows.push({
      'Дата': 'ИТОГО',
      'Рейс №': '',
      'Категория': '',
      'Описание': '',
      'Сумма': '',
      'Валюта': '',
      'В EUR': r2(totalEur),
      'Литры': totalLiters > 0 ? r2(totalLiters) : '',
    });
  }

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
      id, order_number, load_date, unload_date, status,
      client_price_eur, original_client_price, original_currency,
      clients(name)
    `)
    .order('order_number', { ascending: true });

  if (from) query = query.gte('load_date', from);
  if (to) query = query.lte('load_date', to);

  const { data: orders, error } = await query;
  if (error) console.error('[export/forwarding] orders error:', error);

  const ids = (orders || []).map((o: any) => o.id).filter(Boolean) as string[];

  const contractorsByFwd: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: fc, error: fcErr } = await supabase
      .from('forwarding_contractors')
      .select('forwarding_id, price_eur')
      .in('forwarding_id', ids);
    if (fcErr) console.error('[export/forwarding] contractors error:', fcErr);
    (fc || []).forEach((c: any) => {
      if (!c.forwarding_id) return;
      contractorsByFwd[c.forwarding_id] = (contractorsByFwd[c.forwarding_id] || 0) + toNumber(c.price_eur);
    });
  }

  const expensesByFwd: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: fe, error: feErr } = await supabase
      .from('forwarding_expenses')
      .select('forwarding_id, amount_eur')
      .in('forwarding_id', ids);
    if (feErr) console.error('[export/forwarding] expenses error:', feErr);
    (fe || []).forEach((e: any) => {
      if (!e.forwarding_id) return;
      expensesByFwd[e.forwarding_id] = (expensesByFwd[e.forwarding_id] || 0) + toNumber(e.amount_eur);
    });
  }

  const rows: Record<string, unknown>[] = (orders || []).map((o: any) => {
    const clientPrice = toNumber(o.client_price_eur);
    const cSum = contractorsByFwd[o.id] || 0;
    const eSum = expensesByFwd[o.id] || 0;
    return {
      '№ заявки': o.order_number || '',
      'Дата загрузки': isoDate(o.load_date),
      'Дата выгрузки': isoDate(o.unload_date),
      'Клиент': pickName(o.clients),
      'Клиент платит (EUR)': r2(clientPrice),
      'Подрядчикам (EUR)': r2(cSum),
      'Доп. расходы (EUR)': r2(eSum),
      'Маржа (EUR)': r2(clientPrice - cSum - eSum),
      'Статус': statusLabel(o.status),
    };
  });

  const totalClient = rows.reduce((s, r) => s + (r['Клиент платит (EUR)'] as number || 0), 0);
  const totalContractor = rows.reduce((s, r) => s + (r['Подрядчикам (EUR)'] as number || 0), 0);
  const totalExtra = rows.reduce((s, r) => s + (r['Доп. расходы (EUR)'] as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      '№ заявки': 'ИТОГО',
      'Дата загрузки': '',
      'Дата выгрузки': '',
      'Клиент': '',
      'Клиент платит (EUR)': r2(totalClient),
      'Подрядчикам (EUR)': r2(totalContractor),
      'Доп. расходы (EUR)': r2(totalExtra),
      'Маржа (EUR)': r2(totalClient - totalContractor - totalExtra),
      'Статус': '',
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
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

  const rows: Record<string, unknown>[] = Object.values(stats)
    .sort((a, b) => b.revenue - a.revenue)
    .map((s) => ({
      'Клиент': s.name,
      'Тип': s.type,
      'Сделок': s.count,
      'Доход (EUR)': r2(s.revenue),
    }));

  const totalRevenue = rows.reduce((s, r) => s + (r['Доход (EUR)'] as number || 0), 0);
  const totalDeals = rows.reduce((s, r) => s + (r['Сделок'] as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      'Клиент': 'ИТОГО',
      'Тип': '',
      'Сделок': totalDeals,
      'Доход (EUR)': r2(totalRevenue),
    });
  }

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
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';

  const supabase = await createClient();

  let sheet: XLSX.WorkSheet;
  let sheetName: string;
  let baseName: string;

  try {
    if (type === 'trips') {
      sheet = await buildTripsSheet(supabase, from, to);
      sheetName = 'Рейсы';
      baseName = `Trips_${from || 'all'}_${to || 'all'}`;
    } else if (type === 'expenses') {
      sheet = await buildExpensesSheet(supabase, from, to);
      sheetName = 'Расходы рейсов';
      baseName = `Expenses_${from || 'all'}_${to || 'all'}`;
    } else if (type === 'forwarding') {
      sheet = await buildForwardingSheet(supabase, from, to);
      sheetName = 'Экспедирование';
      baseName = `Forwarding_${from || 'all'}_${to || 'all'}`;
    } else if (type === 'clients') {
      sheet = await buildClientsSheet(supabase);
      sheetName = 'Прибыльность клиентов';
      baseName = `Clients_${new Date().toISOString().split('T')[0]}`;
    } else {
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }

    // CSV
    if (format === 'csv') {
      const csvBody = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
      const csvWithBom = '\uFEFF' + csvBody;

      return new NextResponse(csvWithBom, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    // XLSX (по умолчанию)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
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
