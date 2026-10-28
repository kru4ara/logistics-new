import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSessionContext } from '../../../lib/session';
import { can } from '../../../lib/roles';
import { createClient } from '../../../lib/supabase/admin';
import { buildRouteMap } from '../../../lib/trip-route';

export const dynamic = 'force-dynamic';

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

async function buildTripsSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<ExcelJS.Worksheet> {
  let query = supabase
    .from('trips')
    .select(`
      id, trip_number, start_date, end_date, status, revenue_eur, actual_km,
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

  const { data: segs } = tripIds.length > 0
    ? await supabase
        .from('trip_segments')
        .select('trip_id, position, from_city, from_country, to_city, to_country')
        .in('trip_id', tripIds)
    : { data: [] };
  const routeByTrip = buildRouteMap(segs || []);

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
    const routeInfo = routeByTrip.get(t.id);
    return {
      tripNumber: t.trip_number || '',
      start: isoDate(t.start_date),
      end: isoDate(t.end_date),
      client: pickName(t.clients),
      truck: t.trucks?.registration_number || '',
      driver,
      route: routeInfo?.route || '',
      revenue: r2(revenue),
      expenses: r2(exp),
      profit: r2(revenue - exp),
      km: toNumber(t.actual_km),
      status: statusLabel(t.status),
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue as number || 0), 0);
  const totalExpenses = rows.reduce((s, r) => s + (r.expenses as number || 0), 0);
  const totalKm = rows.reduce((s, r) => s + (r.km as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      tripNumber: 'ИТОГО',
      start: '',
      end: '',
      client: '',
      truck: '',
      driver: '',
      route: '',
      revenue: r2(totalRevenue),
      expenses: r2(totalExpenses),
      profit: r2(totalRevenue - totalExpenses),
      km: r2(totalKm),
      status: '',
    });
  }

  const ws = new ExcelJS.Workbook().addWorksheet('Рейсы');
  ws.columns = [
    { header: '№ рейса', key: 'tripNumber', width: 10 },
    { header: 'Старт', key: 'start', width: 12 },
    { header: 'Финиш', key: 'end', width: 12 },
    { header: 'Клиент', key: 'client', width: 25 },
    { header: 'Тягач', key: 'truck', width: 12 },
    { header: 'Водитель', key: 'driver', width: 20 },
    { header: 'Маршрут', key: 'route', width: 40 },
    { header: 'Фрахт (EUR)', key: 'revenue', width: 14, style: { numFmt: '0.00' } },
    { header: 'Расходы (EUR)', key: 'expenses', width: 14, style: { numFmt: '0.00' } },
    { header: 'Прибыль (EUR)', key: 'profit', width: 14, style: { numFmt: '0.00' } },
    { header: 'Пробег (км)', key: 'km', width: 12 },
    { header: 'Статус', key: 'status', width: 16 },
  ];
  ws.addRows(rows);
  return ws;
}

async function buildExpensesSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<ExcelJS.Worksheet> {
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
    date: isoDate(e.expense_date),
    tripNumber: e.trips?.trip_number || '',
    category: categoryLabel(e.category),
    description: e.description || '',
    amount: toNumber(e.original_amount),
    currency: e.currency || '',
    eur: r2(toNumber(e.amount_eur)),
    liters: e.liters != null ? toNumber(e.liters) : '',
  }));

  const totalEur = rows.reduce((s, r) => s + (r.eur as number || 0), 0);
  const totalLiters = rows.reduce((s, r) => s + (typeof r.liters === 'number' ? r.liters : 0), 0);

  if (rows.length > 0) {
    rows.push({
      date: 'ИТОГО',
      tripNumber: '',
      category: '',
      description: '',
      amount: '',
      currency: '',
      eur: r2(totalEur),
      liters: totalLiters > 0 ? r2(totalLiters) : '',
    });
  }

  const ws = new ExcelJS.Workbook().addWorksheet('Расходы рейсов');
  ws.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Рейс №', key: 'tripNumber', width: 10 },
    { header: 'Категория', key: 'category', width: 18 },
    { header: 'Описание', key: 'description', width: 40 },
    { header: 'Сумма', key: 'amount', width: 12 },
    { header: 'Валюта', key: 'currency', width: 8 },
    { header: 'В EUR', key: 'eur', width: 12, style: { numFmt: '0.00' } },
    { header: 'Литры', key: 'liters', width: 10 },
  ];
  ws.addRows(rows);
  return ws;
}

async function buildForwardingSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string | null,
  to: string | null
): Promise<ExcelJS.Worksheet> {
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
      orderNumber: o.order_number || '',
      loadDate: isoDate(o.load_date),
      unloadDate: isoDate(o.unload_date),
      client: pickName(o.clients),
      clientPrice: r2(clientPrice),
      contractorSum: r2(cSum),
      extraExpenses: r2(eSum),
      margin: r2(clientPrice - cSum - eSum),
      status: statusLabel(o.status),
    };
  });

  const totalClient = rows.reduce((s, r) => s + (r.clientPrice as number || 0), 0);
  const totalContractor = rows.reduce((s, r) => s + (r.contractorSum as number || 0), 0);
  const totalExtra = rows.reduce((s, r) => s + (r.extraExpenses as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      orderNumber: 'ИТОГО',
      loadDate: '',
      unloadDate: '',
      client: '',
      clientPrice: r2(totalClient),
      contractorSum: r2(totalContractor),
      extraExpenses: r2(totalExtra),
      margin: r2(totalClient - totalContractor - totalExtra),
      status: '',
    });
  }

  const ws = new ExcelJS.Workbook().addWorksheet('Экспедирование');
  ws.columns = [
    { header: '№ заявки', key: 'orderNumber', width: 12 },
    { header: 'Дата загрузки', key: 'loadDate', width: 14 },
    { header: 'Дата выгрузки', key: 'unloadDate', width: 14 },
    { header: 'Клиент', key: 'client', width: 25 },
    { header: 'Клиент платит (EUR)', key: 'clientPrice', width: 18, style: { numFmt: '0.00' } },
    { header: 'Подрядчикам (EUR)', key: 'contractorSum', width: 18, style: { numFmt: '0.00' } },
    { header: 'Доп. расходы (EUR)', key: 'extraExpenses', width: 18, style: { numFmt: '0.00' } },
    { header: 'Маржа (EUR)', key: 'margin', width: 14, style: { numFmt: '0.00' } },
    { header: 'Статус', key: 'status', width: 16 },
  ];
  ws.addRows(rows);
  return ws;
}

async function buildClientsSheet(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ExcelJS.Worksheet> {
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
      client: s.name,
      type: s.type,
      deals: s.count,
      revenue: r2(s.revenue),
    }));

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue as number || 0), 0);
  const totalDeals = rows.reduce((s, r) => s + (r.deals as number || 0), 0);

  if (rows.length > 0) {
    rows.push({
      client: 'ИТОГО',
      type: '',
      deals: totalDeals,
      revenue: r2(totalRevenue),
    });
  }

  const ws = new ExcelJS.Workbook().addWorksheet('Прибыльность клиентов');
  ws.columns = [
    { header: 'Клиент', key: 'client', width: 35 },
    { header: 'Тип', key: 'type', width: 16 },
    { header: 'Сделок', key: 'deals', width: 10 },
    { header: 'Доход (EUR)', key: 'revenue', width: 16, style: { numFmt: '0.00' } },
  ];
  ws.addRows(rows);
  return ws;
}

export async function GET(request: Request) {
  const { role } = await getSessionContext();
  if (!can(role, 'export.view')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'trips';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';

  const supabase = await createClient();

  let sheet: ExcelJS.Worksheet;
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

    if (format === 'csv') {
      const csvBuffer = await sheet.workbook.csv.writeBuffer({
        sheetName,
        formatterOptions: { delimiter: ';' },
      });
      const csvWithBom = '\uFEFF' + Buffer.from(csvBuffer).toString('utf-8');

      return new NextResponse(csvWithBom, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    const buffer = await sheet.workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
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
