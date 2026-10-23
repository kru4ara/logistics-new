import Link from 'next/link';
import { createClient } from '../../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import {
  ArrowLeft,
  Pencil,
  Truck as TruckIcon,
  Container,
  BarChart3,
  TrendingUp,
  Gauge,
  Fuel,
  Route as RouteIcon,
  Calendar,
  UserCircle,
  Shield,
  Wrench,
  ClipboardCheck,
  Globe,
  FileCheck,
  Inbox,
  Download,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

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

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return (rel[0] as any)?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickDriverName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  const d = Array.isArray(rel) ? rel[0] : rel;
  if (typeof d === 'object' && d) {
    const first = (d as any).first_name;
    const last = (d as any).last_name;
    if (first || last) return `${first || ''} ${last || ''}`.trim();
  }
  return undefined;
}

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;
  if (!truckId) return <div className="p-8">Ошибка: ID машины не передан</div>;

  const supabase = await createClient();

  const { data: truck, error: truckError } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (truckError) return <div className="p-8 text-red-500">Ошибка загрузки: {truckError.message}</div>;

  // Рейсы машины — и как тягач, и как прицеп. Без legacy route — маршрут из сегментов ниже ⬅️ ИЗМЕНЕНО
  const { data: trips } = await supabase
    .from('trips')
    .select('id, trip_number, status, revenue_eur, actual_km, actual_liters, start_date, end_date, truck_id, trailer_id, clients(name), drivers!driver_id(first_name, last_name)')
    .or(`truck_id.eq.${truckId},trailer_id.eq.${truckId}`)
    .order('trip_number', { ascending: false });

  // Маршруты рейсов — из trip_segments ⬅️ ИЗМЕНЕНО
  const tripIds = (trips || []).map((t) => t.id);
  const routeByTrip = new Map<string, string>();
  if (tripIds.length > 0) {
    const { data: segRows } = await supabase
      .from('trip_segments')
      .select('trip_id, position, from_city, from_country, to_city, to_country')
      .in('trip_id', tripIds);

    const routeMap = buildRouteMap((segRows || []) as SegmentRouteRow[]);
    routeMap.forEach((info, tripId) => {
      if (info.route) routeByTrip.set(tripId, info.route);
    });
  }

  const totalTrips = trips?.length || 0;
  const totalRevenue = (trips || []).reduce((s, t) => s + (t.revenue_eur || 0), 0);
  const totalKm = (trips || []).reduce((s, t) => s + (t.actual_km || 0), 0);
  const totalLiters = (trips || []).reduce((s, t) => s + (t.actual_liters || 0), 0);
  const avgConsumption = totalKm > 0 ? (totalLiters / totalKm) * 100 : null;
  const activeTripsCount = (trips || []).filter((t) => t.status === 'active').length;
  const lastTrips = (trips || []).slice(0, 5);

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function daysBadge(dateString: string | null) {
    const days = getDaysUntil(dateString);
    if (days === null) return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: '—' };
    if (days < 0) return { color: 'bg-red-50 text-red-700 border-red-200', label: `${days} дн.` };
    if (days < 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${days} дн.` };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${days} дн.` };
  }

    // ⬅️ НОВОЕ: бейдж "считывание тахографа"
  function downloadBadge(lastDate: string | null, warnAfter: number, maxAfter: number) {
    const days = getDaysUntil(lastDate);
    if (lastDate === null || days === null) {
      return {
        color: 'bg-slate-100 text-slate-500 border-slate-200',
        label: 'нет данных',
        daysAgo: null as number | null,
      };
    }
    const daysAgo = -days;
    if (daysAgo > maxAfter) {
      return {
        color: 'bg-red-50 text-red-700 border-red-200',
        label: `просрочено · ${daysAgo} дн.`,
        daysAgo,
      };
    }
    if (daysAgo > warnAfter) {
      return {
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        label: `${daysAgo} дн.`,
        daysAgo,
      };
    }
    return {
      color: 'bg-green-50 text-green-700 border-green-200',
      label: `${daysAgo} дн.`,
      daysAgo,
    };
  }

  const TACHO_PERIOD = 96;
  const TACHO_WARN = 90;
  const tachoBadge = downloadBadge(truck.tachograph_last_download, TACHO_WARN, TACHO_PERIOD);
  const isTractor = truck.type === 'tractor';
  const typeLabel = isTractor ? 'Тягач' : truck.type === 'trailer' ? 'Прицеп' : truck.type;
  const TypeIcon = isTractor ? TruckIcon : Container;

  // Набор документов — разный для тягача и прицепа
  const documentFields = isTractor
    ? [
        { label: 'Страховка ОС', value: truck.truck_insurance_expiry, Icon: Shield },
        { label: 'ТО (техобслуживание)', value: truck.to_expiry, Icon: Wrench },
        { label: 'Техосмотр', value: truck.tech_inspection_expiry, Icon: ClipboardCheck },
        { label: 'Пограничная страховка РБ', value: truck.border_insurance_expiry, Icon: Globe },
        { label: 'Калибровка тахографа', value: truck.tachograph_calibration_expiry, Icon: Gauge },
      ]
    : [
        { label: 'Страховка ОС', value: truck.truck_insurance_expiry, Icon: Shield },
        { label: 'Техосмотр', value: truck.tech_inspection_expiry, Icon: ClipboardCheck },
        { label: 'Пограничная страховка РБ', value: truck.border_insurance_expiry, Icon: Globe },
        { label: 'Таможенное свидетельство', value: truck.customs_certificate_expiry, Icon: FileCheck },
      ];

  const hasTechData = truck.brand || truck.model || truck.year || truck.vin || truck.fuel_card_number || truck.trailer_number;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link href="/trucks" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все машины
        </Link>

        {/* Шапка профиля */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500
                              flex items-center justify-center text-white shrink-0 shadow-brand">
                <TypeIcon className="w-8 h-8 md:w-10 md:h-10" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 break-words tracking-tight tabular-nums">
                  {truck.registration_number?.trim() || '—'}
                </h1>
                <p className="text-slate-500 mt-1 text-sm md:text-base break-words">
                  {typeLabel}
                  {truck.brand && ` · ${truck.brand}`}
                  {truck.model && ` ${truck.model}`}
                  {truck.year && ` · ${truck.year}`}
                </p>
              </div>
            </div>

            <Link
              href={`/trucks/${truckId}/edit`}
              className="btn btn-primary w-full sm:w-auto text-sm md:text-base"
            >
              <Pencil className="w-4 h-4" strokeWidth={2} />
              Редактировать
            </Link>
          </div>
        </div>

        {/* 📊 Сводка по работе */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            Работа
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Всего рейсов</span>
                <BarChart3 className="w-4 h-4 text-brand-600" strokeWidth={2} />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">{totalTrips}</div>
              {activeTripsCount > 0 && (
                <div className="text-xs text-brand-500 mt-1">в пути: {activeTripsCount}</div>
              )}
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Общий фрахт</span>
                <TrendingUp className="w-4 h-4 text-green-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
                {totalRevenue > 0 ? `${Math.round(totalRevenue).toLocaleString('ru-RU')} €` : '—'}
              </div>
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Пройдено</span>
                <Gauge className="w-4 h-4 text-slate-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 break-words tabular-nums">
                {totalKm > 0 ? `${Math.round(totalKm).toLocaleString('ru-RU')} км` : '—'}
              </div>
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ср. расход</span>
                <Fuel className="w-4 h-4 text-slate-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 tabular-nums">
                {avgConsumption !== null ? `${avgConsumption.toFixed(1)} л/100` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 🚚 Последние рейсы */}
        {lastTrips.length > 0 && (
          <div className="card p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
                Последние рейсы
              </h2>
              {totalTrips > 5 && (
                <span className="text-xs text-slate-400 tabular-nums">
                  показано 5 из {totalTrips}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {lastTrips.map((t) => {
                const clientName = pickName(t.clients) || '—';
                const driverName = pickDriverName(t.drivers);
                const dateStr = t.end_date || t.start_date;
                const isOurTruck = t.truck_id === truckId;
                const RoleIcon = isOurTruck ? TruckIcon : Container;
                const roleLabel = isOurTruck ? 'тягач' : 'прицеп';
                const routeDisplay = routeByTrip.get(t.id) || '—'; // ⬅️ ИЗМЕНЕНО

                return (
                  <Link
                    key={t.id}
                    href={`/trips/${t.id}`}
                    className="block border border-slate-100 rounded-xl p-3 md:p-4 bg-slate-50/40
                               hover:bg-brand-50/40 hover:border-brand-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-slate-400 tabular-nums">
                            № {t.trip_number || '—'}
                          </span>
                          <span className={`text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap
                                            ${statusColors[t.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {statusLabels[t.status] || t.status}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <RoleIcon className="w-3 h-3" strokeWidth={2} />
                            {roleLabel}
                          </span>
                          {dateStr && (
                            <span className="text-xs text-slate-500 tabular-nums">
                              · {new Date(dateStr).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-slate-800 break-words">
                          {clientName}
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-0.5">
                          <RouteIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words">{routeDisplay}</span>
                        </div>
                        {driverName && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <UserCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <span>{driverName}</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-green-600 whitespace-nowrap tabular-nums">
                          {t.revenue_eur ? `${t.revenue_eur} €` : '—'}
                        </div>
                        {t.actual_km && (
                          <div className="text-xs text-slate-400 tabular-nums">
                            {Math.round(t.actual_km)} км
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Технические данные */}
        {hasTechData && (
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Технические данные
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {truck.brand && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Марка</div>
                  <div className="text-slate-800 font-medium break-words">{truck.brand}</div>
                </div>
              )}
              {truck.model && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Модель</div>
                  <div className="text-slate-800 font-medium break-words">{truck.model}</div>
                </div>
              )}
              {truck.year && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Год выпуска</div>
                  <div className="text-slate-800 font-medium tabular-nums">{truck.year}</div>
                </div>
              )}
              {truck.vin && (
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">VIN</div>
                  <div className="text-slate-800 font-medium break-all tabular-nums">{truck.vin}</div>
                </div>
              )}
              {isTractor && truck.fuel_card_number && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Топливная карта</div>
                  <div className="text-slate-800 font-medium break-words tabular-nums">{truck.fuel_card_number}</div>
                </div>
              )}
              {isTractor && truck.trailer_number && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Прицеп (текстом)</div>
                  <div className="text-slate-800 font-medium break-words tabular-nums">{truck.trailer_number}</div>
                </div>
              )}
            </div>
          </div>
        )}

                {/* 📥 Считывание тахографа (только тягач) */}
        {isTractor && (
          <div className="card p-5 md:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-brand-600" strokeWidth={2} />
                Считывание тахографа
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${tachoBadge.color}`}>
                {tachoBadge.label}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                  Последнее считывание
                </div>
                <div className="text-slate-800 font-medium tabular-nums">
                  {truck.tachograph_last_download
                    ? new Date(truck.tachograph_last_download).toLocaleDateString('ru-RU')
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                  Лимит
                </div>
                <div className="text-slate-800 font-medium tabular-nums">
                  {TACHO_PERIOD} дн. (предупреждение с {TACHO_WARN})
                </div>
              </div>
            </div>

            {tachoBadge.daysAgo === null && (
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                💡 Дата последнего считывания тахографа не указана. Внесите её через <b>«Редактировать»</b>.
              </div>
            )}

            {tachoBadge.daysAgo !== null && tachoBadge.daysAgo > TACHO_PERIOD && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
                <span>
                  <b>Просрочено!</b> Тахограф нужно считывать не реже <b>{TACHO_PERIOD} дней</b>. Считайте как можно скорее.
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* 📅 Сроки документов */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Сроки документов
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {documentFields.map((doc) => {
              const badge = daysBadge(doc.value);
              const Icon = doc.Icon;
              return (
                <div key={doc.label} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={2} />
                    <span className="text-sm font-semibold text-slate-700">{doc.label}</span>
                  </div>
                  <div className="text-slate-800 font-medium mb-2 tabular-nums">
                    {doc.value ? new Date(doc.value).toLocaleDateString('ru-RU') : '—'}
                  </div>
                  <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border tabular-nums ${badge.color}`}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
  );
}
