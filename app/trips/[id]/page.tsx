import Link from 'next/link';
import { createClient } from '../../../lib/supabase-server';
import { deleteTrip } from '../../trip-actions';
import AddExpenseForm from '../AddExpenseForm';
import FileUpload from '../../driver/FileUpload';
import DocumentList from '../../driver/DocumentList';
import TripStatusButtons from '../../driver/TripStatusButtons';
import SyncLogisatButton from './SyncLogisatButton';
import { saveTelemetry } from '../../telemetry-actions';
import CopyBlock from '../../components/CopyBlock';
import SubmitButton from '../../components/SubmitButton';
import SendTaskButton from './SendTaskButton';
import TripCargoBlock from './TripCargoBlock';
import TripSegmentsBlock from './TripSegmentsBlock';
import ExpensesList from '../ExpensesList';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import { buildDriverTaskText } from '../../../lib/trip-task-text';
import RecalcCoordsButton from './RecalcCoordsButton';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileText,
  Route as RouteIcon,
  Truck,
  UserCircle,
  Phone,
  Gauge,
  Activity,
  Paperclip,
  FolderOpen,
  Wallet,
  PlusCircle,
  Settings2,
  AlertTriangle,
  Coins,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
 
const NEGATIVE_FUEL_TOLERANCE = -200;

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-8">Ошибка: ID рейса не передан</div>;

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(first_name, last_name, phone_by, phone_pl, telegram_chat_id), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripError.message}</div>;
  }

  let trailerNumber: string | null = null;
  if (trip.trailer_id) {
    const { data: trailer } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', trip.trailer_id)
      .single();
    trailerNumber = trailer?.registration_number || null;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documents } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false });

  const { data: contractors } = await supabase
    .from('contractors')
    .select('id, name, full_name, country, address, tax_id, contact_person, phone, email')
    .order('name');

  const { data: loadingLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['loading', 'both'])
    .order('name');

  const { data: unloadingLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['unloading', 'both'])
    .order('name');

    const { data: customsLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['customs', 'both'])
    .order('name');

  const { data: clientsList } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const { data: tractorsList } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'tractor')
    .order('registration_number');

  const { data: trailersList } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'trailer')
    .order('registration_number');

  const { data: driversList } = await supabase
    .from('drivers')
    .select('id, first_name, last_name')
    .order('last_name');

  // ============================================================
  // ГРУЗЫ
  // ============================================================
  const { data: cargoRaw } = await supabase
    .from('trip_cargo')
    .select('*, clients(name)')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const cargoList = (cargoRaw || []).map((c: any) => ({
    id: c.id,
    position: c.position,
    label: c.label,
    cargo_type: c.cargo_type,
    weight_kg: c.weight_kg,
    pallets: c.pallets ?? null,
    client_id: c.client_id,
    client_name: pickName(c.clients) || null,
    notes: c.notes,
    from_country: c.from_country,
    from_city: c.from_city,
    from_company: c.from_company,
    from_address: c.from_address,
    from_postal_code: c.from_postal_code,
    to_country: c.to_country,
    to_city: c.to_city,
    to_company: c.to_company,
    to_address: c.to_address,
    to_postal_code: c.to_postal_code,
    customs_place: c.customs_place ?? null,
    customs_country: c.customs_country ?? null,
    customs_city: c.customs_city ?? null,
    customs_postal_code: c.customs_postal_code ?? null,
    customs_address: c.customs_address ?? null,
    customs_lat: c.customs_lat ?? null,
    customs_lng: c.customs_lng ?? null,
    freight_amount: c.freight_amount != null ? Number(c.freight_amount) : null,
    freight_currency: c.freight_currency ?? null,
  }));

  // ============================================================
  // УЧАСТКИ
  // ============================================================
  const { data: segmentsRaw } = await supabase
    .from('trip_segments')
    .select('*, contractors(name), trucks!truck_id(registration_number), trailers:trucks!trailer_id(registration_number), drivers!driver_id(first_name, last_name)')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const segmentIds = (segmentsRaw || []).map((s: any) => s.id);
  const segmentCargoRes = segmentIds.length > 0
    ? await supabase
        .from('trip_segment_cargo')
        .select('segment_id, cargo_id, trip_cargo(position, label)')
        .in('segment_id', segmentIds)
    : { data: [] };

  const cargoLinksBySegment: Record<string, { cargo_id: string; position: number; label: string }[]> = {};
  (segmentCargoRes.data || []).forEach((sc: any) => {
    if (!sc.segment_id || !sc.cargo_id) return;
    const meta = pickOne<{ position: number; label: string | null }>(sc.trip_cargo);
    if (!cargoLinksBySegment[sc.segment_id]) cargoLinksBySegment[sc.segment_id] = [];
    cargoLinksBySegment[sc.segment_id].push({
      cargo_id: sc.cargo_id,
      position: meta?.position || 0,
      label: meta?.label || '—',
    });
  });

  const segments = (segmentsRaw || []).map((s: any) => {
    const truck = pickOne<{ registration_number: string | null }>(s.trucks);
    const trailer = pickOne<{ registration_number: string | null }>(s.trailer);
    const driver = pickOne<{ first_name: string | null; last_name: string | null }>(s.drivers);
    const driverName = driver
      ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
      : null;
    return {
      id: s.id,
      trip_id: s.trip_id,
      position: s.position,
      executor_type: s.executor_type,
      contractor_id: s.contractor_id,
      contractor_name: pickName(s.contractors) || null,
      truck_id: s.truck_id,
      truck_reg: truck?.registration_number || null,
      trailer_id: s.trailer_id, // <-- ДОБАВИТЬ ЭТУ СТРОКУ
      trailer_reg: trailer?.registration_number || null,
      driver_id: s.driver_id,
      driver_name: driverName,
      date_from: s.date_from,
      date_to: s.date_to,
      notes: s.notes,
      price: s.price != null ? Number(s.price) : null,
      currency: s.currency,
      from_country: s.from_country,
      from_city: s.from_city,
      from_company: s.from_company,
      from_address: s.from_address,
      from_postal_code: s.from_postal_code,
      to_country: s.to_country,
      to_city: s.to_city,
      to_company: s.to_company,
      to_address: s.to_address,
      to_postal_code: s.to_postal_code,
      contractor_truck_number: s.contractor_truck_number,
      contractor_driver_name: s.contractor_driver_name,
      contractor_payment_days: s.contractor_payment_days,
      contractor_payment_document_type: s.contractor_payment_document_type,
      contractor_transport_type: s.contractor_transport_type,
      contractor_transport_temperature: s.contractor_transport_temperature,
      stops: Array.isArray(s.stops) ? s.stops : [],
      cargoLinks: cargoLinksBySegment[s.id] || [],
    };
  });

  // Route из сегментов через buildRouteMap
  const routeMap = buildRouteMap((segmentsRaw || []) as SegmentRouteRow[]);
  const computedRoute = routeMap.get(tripId)?.route ?? '—';

  // ============================================================
  // Расчёты
  // ============================================================
  const contractorExpenses = expenses
    ?.filter((e: any) => e.category === 'contractor')
    .reduce((sum: number, e: any) => sum + (e.amount_eur || 0), 0) || 0;

  const otherExpenses = expenses
    ?.filter((e: any) => e.category !== 'contractor')
    .reduce((sum: number, e: any) => sum + (e.amount_eur || 0), 0) || 0;

  const totalExpenses = contractorExpenses + otherExpenses;
  const profit = (trip.revenue_eur || 0) - totalExpenses;

  const refuelLiters = expenses?.filter((e: any) => e.category === 'fuel' && e.liters).reduce((sum: number, e: any) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const fuelLeftIsNegative = fuelLeft < 0;
  const fuelLeftIsCritical = fuelLeft < NEGATIVE_FUEL_TOLERANCE;

  const driver = pickOne<{ first_name: string | null; last_name: string | null; phone_by: string | null; phone_pl: string | null; telegram_chat_id: string | null }>(trip.drivers);
  const truck = pickOne<{ registration_number: string | null }>(trip.trucks);

  // ⬅️ НОВОЕ: предупреждение "ЗП не начислена"
  const hasSalaryExpense = (expenses || []).some((e: any) => e.category === 'salary');
  const needsSalary = trip.status === 'completed' && Boolean(driver) && !hasSalaryExpense;

  const taskText = buildDriverTaskText({
    trip: {
      ...trip,
      clients: { name: pickName(trip.clients) || null },
      id: tripId,
    },
    driver,
    truck,
    trailerNumber,
    segments: segments as any,
    markdown: false,
  });

  const driverHasTelegram = Boolean(driver?.telegram_chat_id);
  const sendDisabled = !driver || !driverHasTelegram;
  const sendHint = !driver
    ? 'Сначала назначьте водителя в рейсе'
    : !driverHasTelegram
      ? `Водитель ${driver.first_name} ${driver.last_name} не подключён к Telegram. Откройте его карточку и пришлите ему персональную ссылку.`
      : undefined;

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все рейсы
        </Link>

        {/* ЗАГОЛОВОК */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium">Рейс</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">
                № {trip.trip_number || '—'}
              </h1>
              <div className="text-sm text-slate-500 mt-1">
                {trip.clients?.name || 'Клиент не указан'}
              </div>
              {trip.client_request_number && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 flex-wrap">
                  <FileText className="w-4 h-4 shrink-0 text-slate-400" strokeWidth={2} />
                  <span>Заявка № <b className="text-slate-700">{trip.client_request_number}</b></span>
                  {trip.client_request_date && (
                    <span className="text-slate-400 ml-1">
                      от {new Date(trip.client_request_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className={`self-start px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          {/* ДЕЙСТВИЯ ПО РЕЙСУ (сжатые) */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={true} />
          </div>

          {/* КНОПКИ РЕДАКТИРОВАНИЯ */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Link
              href={`/trips/${tripId}/edit`}
              className="btn btn-secondary text-sm flex-1 sm:flex-none"
            >
              <Pencil className="w-4 h-4" strokeWidth={2} />
              Редактировать
            </Link>
            <SyncLogisatButton
              tripId={tripId}
              disabled={!trip.trip_number}
              disabledHint="Сначала назначьте транспорт (участок «Наша машина»)"
            />
            <form action={deleteTrip.bind(null, tripId)} className="flex-1 sm:flex-none">
              <button type="submit" className="btn btn-danger text-sm w-full">
                <Trash2 className="w-4 h-4" strokeWidth={2} />
                Удалить
              </button>
            </form>
          </div>

          {/* ТЕЛЕМЕТРИЯ (Перенесена сюда) */}
          <div className="bg-slate-50 rounded-xl p-3 md:p-4 mb-4">
            <form action={async (formData: FormData) => {
              'use server';
              const km = parseFloat(formData.get('km') as string) || 0;
              const liters = parseFloat(formData.get('liters') as string) || 0;
              await saveTelemetry(tripId, km, liters);
            }} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Пробег (км)</label>
                <input type="number" name="km" step="0.01" placeholder={trip.actual_km?.toString() || '0'} className="input py-1.5 text-sm" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Топливо (л)</label>
                <input type="number" name="liters" step="0.01" placeholder={trip.actual_liters?.toString() || '0'} className="input py-1.5 text-sm" />
              </div>
              <SubmitButton
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all"
                pendingText="…"
              >
                Сохранить
              </SubmitButton>
            </form>
            {trip.actual_km && trip.actual_km > 0 && (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <span>Текущие: <b className="tabular-nums">{trip.actual_km} км / {trip.actual_liters} л</b></span>
                <span className={`font-bold ${fuelLeftIsCritical ? 'text-red-600' : fuelLeftIsNegative ? 'text-amber-600' : 'text-brand-600'}`}>
                  (Остаток: {fuelLeft.toFixed(1)} л)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ⚠️ ЗП не начислена */}
        {needsSalary && (
          <div className="card border-l-4 border-l-amber-500 bg-amber-50/40 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="font-bold text-amber-900 text-sm md:text-base">
                  ЗП водителю не начислена
                </div>
                <div className="text-xs md:text-sm text-amber-800 mt-1">
                  Рейс завершён, но расход <b>«💶 ЗП водителя»</b> не создан.
                  Добавьте его ниже в блоке <b>«Добавить расход»</b> — или переведите рейс обратно
                  в «В пути», если работа не закончена.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* ИНФОРМАЦИЯ */}
        <div className="card p-5 md:p-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
              <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="break-words">{computedRoute}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тягач / Прицеп</div>
              <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                <Truck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="break-words">
                  {truck?.registration_number || '—'}
                  {trailerNumber && ` / ${trailerNumber}`}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Водитель</div>
              <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                <UserCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="break-words">
                  {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
                </span>
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефоны</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-800 font-medium text-sm">
                {driver?.phone_by ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                    <span className="text-xs font-semibold text-slate-400">BY</span>
                    <a href={`tel:${driver.phone_by}`} className="hover:text-brand-600 tabular-nums">
                      {driver.phone_by}
                    </a>
                  </span>
                ) : null}
                {driver?.phone_pl ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                    <span className="text-xs font-semibold text-slate-400">PL</span>
                    <a href={`tel:${driver.phone_pl}`} className="hover:text-brand-600 tabular-nums">
                      {driver.phone_pl}
                    </a>
                  </span>
                ) : null}
                {!driver?.phone_by && !driver?.phone_pl && (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-lg md:text-xl font-bold text-green-600 break-words tabular-nums">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Топливо</div>
              <div className="text-lg md:text-xl font-bold text-brand-600 tabular-nums">
                {trip.start_fuel_level || 0} л
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Старт</div>
              <div className="text-lg md:text-xl font-bold text-slate-800 tabular-nums">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Финиш</div>
              <div className={`text-lg md:text-xl font-bold tabular-nums ${trip.end_date ? 'text-emerald-600' : 'text-slate-400'}`}>
                {trip.end_date ? new Date(trip.end_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
          </div>

          {(trip.start_odometer || trip.end_odometer || trip.actual_km) && (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mt-4 pt-4 border-t border-slate-100">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Одометр старта</div>
                <div className="text-lg md:text-xl font-bold text-slate-700 tabular-nums">
                  {trip.start_odometer ? `${trip.start_odometer} км` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Одометр финиша</div>
                <div className="text-lg md:text-xl font-bold text-slate-700 tabular-nums">
                  {trip.end_odometer ? `${trip.end_odometer} км` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Пробег за рейс</div>
                <div className="text-lg md:text-xl font-bold text-emerald-600 tabular-nums">
                  {trip.actual_km ? `${trip.actual_km} км` : '—'}
                </div>
              </div>
            </div>
          )}

          {trip.logisat_synced_at && (
            <div className="text-xs text-slate-400 mt-3 text-right">
              Logisat синхронизирован: {new Date(trip.logisat_synced_at).toLocaleString('ru-RU')}
            </div>
          )}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-400">
              {trip.start_lat && trip.start_lng ? 'Координаты есть' : 'Координаты не заполнены'}
            </div>
            <RecalcCoordsButton tripId={tripId} />
          </div>
        </div>

        {/* ГРУЗЫ */}
        <TripCargoBlock
          tripId={tripId}
          cargoList={cargoList}
          clients={(clientsList || []).map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={(loadingLocations || []) as any}
          unloadingLocations={(unloadingLocations || []) as any}
          customsLocations={(customsLocations || []) as any}
          defaultClientId={trip.client_id}
        />

        {/* УЧАСТКИ */}
        <TripSegmentsBlock
          tripId={tripId}
          segments={segments as any}
          contractors={(contractors || []).map((c) => ({ id: c.id, label: c.name }))}
          trucks={(tractorsList || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          trailers={(trailersList || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          drivers={(driversList || []).map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
          loadingLocations={(loadingLocations || []) as any}
          unloadingLocations={(unloadingLocations || []) as any}
          customsLocations={(customsLocations || []) as any}
          cargoList={cargoList.map((c) => ({
            id: c.id,
            position: c.position,
            label: c.label || '—',
            from_country: c.from_country,
            from_city: c.from_city,
            from_company: c.from_company,
            from_address: c.from_address,
            from_postal_code: c.from_postal_code,
            to_country: c.to_country,
            to_city: c.to_city,
            to_company: c.to_company,
            to_address: c.to_address,
            to_postal_code: c.to_postal_code,
          }))}
        />

        {/* ЗАДАНИЕ ДЛЯ ВОДИТЕЛЯ */}
        <div className="space-y-3">
          <CopyBlock text={taskText} phone={driver?.phone_pl || driver?.phone_by} />
          <div className="card p-5 md:p-6">
            <SendTaskButton tripId={tripId} disabled={sendDisabled} disabledHint={sendHint} />
          </div>
        </div>

        {/* ЗАГРУЗКА ДОКУМЕНТОВ */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загрузить документы
          </h2>
          <FileUpload tripId={tripId} />
        </div>

        {/* ЗАГРУЖЕННЫЕ ФАЙЛЫ */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загруженные файлы
          </h2>
          <DocumentList documents={documents || []} tripId={tripId} canDelete={true} />
        </div>

        {/* РАСХОДЫ (вынесены в отдельный клиентский компонент) */}
        <ExpensesList
          expenses={expenses || []}
          segments={segments}
          tripId={tripId}
          totalExpenses={totalExpenses}
        />

        {/* ЭКОНОМИКА */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Экономика рейса
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="text-sm font-medium text-slate-700">Фрахт</div>
              <div className="text-lg font-bold text-green-600 tabular-nums">
                {(trip.revenue_eur || 0).toFixed(2)} €
              </div>
            </div>

            {contractorExpenses > 0 && (
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-slate-400" strokeWidth={2} />
                  Подрядчики
                </div>
                <div className="text-lg font-bold text-red-600 tabular-nums">
                  −{contractorExpenses.toFixed(2)} €
                </div>
              </div>
            )}

            {otherExpenses > 0 && (
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-700">Прочие расходы</div>
                <div className="text-lg font-bold text-red-600 tabular-nums">
                  −{otherExpenses.toFixed(2)} €
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-base font-bold text-slate-900">Прибыль</div>
              <div className={`text-2xl font-bold tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {profit.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>

        {/* ДОБАВИТЬ РАСХОД */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Добавить расход
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Расход подрядчику создаётся автоматически из участка. Здесь — прочие расходы:
            топливо, EPI, стоянки, дозволы, ЗП водителя и т.д.
          </p>
          <AddExpenseForm
            tripId={tripId}
            hasDriver={Boolean(driver)}
            driverName={driver ? `${driver.first_name} ${driver.last_name}` : null}
            allowSalary={true}
          />
        </div>

      </div>
    </main>
  );
}
