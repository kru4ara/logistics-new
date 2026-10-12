import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import TripCargoBlock from '../TripCargoBlock';
import TripSegmentsBlock from '../TripSegmentsBlock';
import {
  ArrowLeft,
  FileText,
  Route as RouteIcon,
  Calendar,
  UserCircle,
  Truck as TruckIcon,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

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

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

export default async function TripsTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(first_name, last_name), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return <div className="p-8 text-red-500">Рейс не найден: {error?.message}</div>;
  }

  const [
    cargoRes,
    clientsRes,
    loadingRes,
    unloadingRes,
    contractorsRes,
    trucksRes,
    driversRes,
    segmentsRes,
  ] = await Promise.all([
    supabase
      .from('trip_cargo')
      .select('*, clients(name)')
      .eq('trip_id', tripId)
      .order('position', { ascending: true }),
    supabase.from('clients').select('id, name').order('name'),
    supabase
      .from('locations')
      .select('*')
      .in('type', ['loading', 'both'])
      .order('name'),
    supabase
      .from('locations')
      .select('*')
      .in('type', ['unloading', 'both'])
      .order('name'),
    supabase.from('contractors').select('id, name').order('name'),
    supabase
      .from('trucks')
      .select('id, registration_number')
      .eq('type', 'tractor')
      .order('registration_number'),
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .order('last_name'),
    supabase
      .from('trip_segments')
      .select('*, contractors(name), trucks!truck_id(registration_number), drivers!driver_id(first_name, last_name)')
      .eq('trip_id', tripId)
      .order('position', { ascending: true }),
  ]);

  const segmentIds = (segmentsRes.data || []).map((s: any) => s.id);
  const segmentCargoRes = segmentIds.length > 0
    ? await supabase
        .from('trip_segment_cargo')
        .select('segment_id, cargo_id, trip_cargo(position, label)')
        .in('segment_id', segmentIds)
    : { data: [] };

  const cargoList = (cargoRes.data || []).map((c: any) => ({
    id: c.id,
    position: c.position,
    label: c.label,
    cargo_type: c.cargo_type,
    weight_kg: c.weight_kg,
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
  }));

  const cargoLinksBySegment: Record<string, { cargo_id: string; position: number; label: string }[]> = {};
  (segmentCargoRes.data || []).forEach((sc: any) => {
    if (!sc.segment_id || !sc.cargo_id) return;
    const cargoMeta = pickOne<{ position: number; label: string | null }>(sc.trip_cargo);
    if (!cargoLinksBySegment[sc.segment_id]) cargoLinksBySegment[sc.segment_id] = [];
    cargoLinksBySegment[sc.segment_id].push({
      cargo_id: sc.cargo_id,
      position: cargoMeta?.position || 0,
      label: cargoMeta?.label || '—',
    });
  });

  const segments = (segmentsRes.data || []).map((s: any) => {
    const truck = pickOne<{ registration_number: string | null }>(s.trucks);
    const driver = pickOne<{ first_name: string | null; last_name: string | null }>(s.drivers);
    const driverName = driver
      ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
      : null;
    return {
      id: s.id,
      position: s.position,
      executor_type: s.executor_type,
      contractor_id: s.contractor_id,
      contractor_name: pickName(s.contractors) || null,
      truck_id: s.truck_id,
      truck_reg: truck?.registration_number || null,
      driver_id: s.driver_id,
      driver_name: driverName,
      date_from: s.date_from,
      date_to: s.date_to,
      notes: s.notes,
      cargoLinks: cargoLinksBySegment[s.id] || [],
    };
  });

  const clientsList = clientsRes.data || [];
  const loadingLocations = loadingRes.data || [];
  const unloadingLocations = unloadingRes.data || [];
  const contractorsList = contractorsRes.data || [];
  const trucksList = trucksRes.data || [];
  const driversList = driversRes.data || [];

  const driver = pickOne<{ first_name: string | null; last_name: string | null }>(trip.drivers);
  const truck = pickOne<{ registration_number: string | null }>(trip.trucks);
  const driverName = driver
    ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
    : null;
  const clientName = pickName(trip.clients) || 'Клиент не указан';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/trips-test"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все рейсы (тест)
        </a>

        <div className="card p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                Рейс № {trip.trip_number || '—'}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 break-words">
                {clientName}
              </h1>
              {trip.client_request_number && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                  <FileText className="w-4 h-4 text-slate-400" strokeWidth={2} />
                  <span>Заявка: <b className="text-slate-700">{trip.client_request_number}</b></span>
                </div>
              )}
            </div>
            <span className={`self-start shrink-0 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-slate-100">
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
              <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="break-words">{trip.route || '—'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тягач</div>
              <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                <TruckIcon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="tabular-nums">{truck?.registration_number || '—'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Водитель</div>
              <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                <UserCircle className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="break-words">{driverName || '—'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Старт</div>
              <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="tabular-nums">{fmtDate(trip.start_date)}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Финиш</div>
              <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <span className="tabular-nums">{fmtDate(trip.end_date)}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-slate-800 font-bold text-lg tabular-nums">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ГРУЗЫ */}
        <TripCargoBlock
          tripId={tripId}
          cargoList={cargoList}
          clients={clientsList.map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={loadingLocations as any}
          unloadingLocations={unloadingLocations as any}
          defaultClientId={trip.client_id}
        />

        {/* УЧАСТКИ */}
        <TripSegmentsBlock
          tripId={tripId}
          segments={segments}
          contractors={contractorsList.map((c) => ({ id: c.id, label: c.name }))}
          trucks={trucksList.map((t) => ({ id: t.id, label: t.registration_number }))}
          drivers={driversList.map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
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

        <div className="card p-5 md:p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">
            Остальные данные рейса
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Экономика, расходы, документы, телеметрия — пока в основной карточке.
          </p>
          <a
            href={`/trips/${tripId}`}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={2.2} />
            Открыть полную карточку рейса
          </a>
        </div>

      </div>
    </main>
  );
}
