import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Route as RouteIcon,
  Rocket,
  Flag,
  MapPin,
  Package,
  Settings2,
  Fuel,
  AlertTriangle,
  Paperclip,
  FolderOpen,
  Receipt,
  PlusCircle,
  Trash2,
  Calendar,
  Globe,
  DoorOpen,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '../../../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow } from '../../../../lib/trip-route';
import { deleteExpense } from '../../../trip-actions';
import AddExpenseForm from '../../../trips/AddExpenseForm';
import FileUpload from '../../FileUpload';
import DocumentList from '../../DocumentList';
import TripStatusButtons from '../../TripStatusButtons';

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

type CargoLink = {
  cargo_id: string;
  position: number;
  label: string;
};

type StopDb = {
  type: 'load' | 'reload' | 'unload';
  company: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  date: string | null;
};

export default async function DriverTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-6">Ошибка: ID рейса не передан</div>;

  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'driver') redirect('/login');

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('id', tripId)
    .single();

  if (tripError) return <div className="p-6 text-red-500">Ошибка: {tripError.message}</div>;

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documents } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false });

  const { data: segmentsRaw } = await supabase
    .from('trip_segments')
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const routeMap = buildRouteMap(
    (segmentsRaw || []).map((s: any) => ({
      trip_id: s.trip_id,
      position: s.position,
      from_city: s.from_city,
      from_country: s.from_country,
      to_city: s.to_city,
      to_country: s.to_country,
    })) as SegmentRouteRow[]
  );
  const routeDisplay = routeMap.get(tripId)?.route ?? '—';

  const usSegmentsRaw = (segmentsRaw || []).filter((s: any) => s.executor_type === 'us');
  const segmentIds = usSegmentsRaw.map((s: any) => s.id);
  const segmentCargoRes = segmentIds.length > 0
    ? await supabase
        .from('trip_segment_cargo')
        .select('segment_id, cargo_id, trip_cargo(position, label)')
        .in('segment_id', segmentIds)
    : { data: [] };

  const cargoLinksBySegment: Record<string, CargoLink[]> = {};
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

  const usSegments = usSegmentsRaw.map((s: any) => ({
    id: s.id,
    position: s.position,
    date_from: s.date_from,
    date_to: s.date_to,
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
    stops: Array.isArray(s.stops) ? s.stops : [],
    cargoLinks: cargoLinksBySegment[s.id] || [],
  }));

  const refuelLiters = expenses?.filter(e => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const fuelLeftIsNegative = fuelLeft < 0;
  const fuelLeftIsCritical = fuelLeft < NEGATIVE_FUEL_TOLERANCE;

  const clientName = pickName(trip.clients) || 'Клиент не указан';

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

  const expenseCategories: { value: string; label: string; emoji: string }[] = [
    { value: 'fuel', label: 'Топливо', emoji: '⛽' },
    { value: 'epi', label: 'EPI', emoji: '📄' },
    { value: 'border', label: 'Граница', emoji: '🛂' },
    { value: 'contractor', label: 'Подрядчик', emoji: '🚛' },
    { value: 'permit', label: 'Дозвол', emoji: '📋' },
    { value: 'tlc', label: 'ТЛЦ', emoji: '🏭' },
    { value: 'waiting', label: 'Зона ожидания', emoji: '⏳' },
    { value: 'repair', label: 'Ремонт', emoji: '🔧' },
    { value: 'parking', label: 'Паркинг', emoji: '🅿️' },
    { value: 'disinfection', label: 'Дезинфекция', emoji: '🧴' },
    { value: 'ex1', label: 'ЕХ-1', emoji: '🧾' },
    { value: 'otkat', label: 'Откат', emoji: '🔄' },
    { value: 'gps_seal', label: 'GPS пломба', emoji: '📡' },
    { value: 'other', label: 'Другое', emoji: '📌' },
  ];

  function categoryLabel(cat: string): string {
    return expenseCategories.find((c) => c.value === cat)?.label || cat;
  }

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  const fuelCardClass = fuelLeftIsCritical
    ? 'bg-gradient-to-br from-red-600 to-red-800'
    : fuelLeftIsNegative
      ? 'bg-gradient-to-br from-amber-500 to-amber-700'
      : 'bg-gradient-to-br from-brand-600 to-brand-800';

  const stopTypeLabel: Record<StopDb['type'], string> = {
    load: 'Загрузка',
    reload: 'Догруз / перегруз',
    unload: 'Выгрузка',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Мои рейсы
        </a>

        {/* Заголовок */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                Рейс № {trip.trip_number || '—'}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1 break-words">
                {clientName}
              </h1>
            </div>
            <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
            <span className="break-words">{routeDisplay}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-600 inline-flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
              Старт: <b className="text-slate-800 tabular-nums">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </b>
            </span>
            {trip.end_date ? (
              <span className="text-emerald-700 inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                Финиш: <b className="tabular-nums">{new Date(trip.end_date).toLocaleDateString('ru-RU')}</b>
              </span>
            ) : (
              <span className="text-slate-400 inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                Финиш: —
              </span>
            )}
          </div>
        </div>

        {/* Кнопки статуса */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" strokeWidth={2} />
            Действия по рейсу
          </h2>
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={false} />
        </div>

        {/* Остаток топлива */}
        <div className={`${fuelCardClass} rounded-2xl p-5 shadow-lg text-white`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-white/80">Остаток топлива в баке</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">{fuelLeft.toFixed(1)} л</div>
            </div>
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Fuel className="w-7 h-7" strokeWidth={2} />
            </div>
          </div>

          {fuelLeftIsNegative && (
            <div className="mt-3 rounded-xl px-3 py-2 text-xs font-medium bg-white/15 text-white flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>
                {fuelLeftIsCritical
                  ? 'Значительный недостаток топлива. Проверьте заправки и данные о расходе — цифры выглядят недостоверными.'
                  : 'Остаток отрицательный (в пределах нормы). Расхождение факта и учёта по топливу.'}
              </span>
            </div>
          )}

          {trip.actual_liters && trip.actual_km ? (
            <div className="text-xs text-white/80 mt-3 tabular-nums">
              Последние данные: {trip.actual_km} км / {trip.actual_liters} л · Расход: {((trip.actual_liters / trip.actual_km) * 100).toFixed(1)} л/100 км
            </div>
          ) : null}
        </div>

        {/* Задание */}
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Задание
          </h2>

          {usSegments.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">
              Маршрут ещё не назначен
            </div>
          ) : (
            <div className="space-y-5">
              {usSegments.map((seg, segIdx) => (
                <div key={seg.id} className="space-y-3">
                  {usSegments.length > 1 && (
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Участок {segIdx + 1}
                    </div>
                  )}

                  {(seg.date_from || seg.date_to) && (
                    <div className="text-xs text-slate-500 inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                      {seg.date_from && new Date(seg.date_from).toLocaleDateString('ru-RU')}
                      {seg.date_from && seg.date_to && ' → '}
                      {seg.date_to && new Date(seg.date_to).toLocaleDateString('ru-RU')}
                    </div>
                  )}

                  <div className="border-l-4 border-green-500 pl-3 py-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1 inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                      Загрузка
                    </div>
                    <div className="font-bold text-slate-900 text-sm break-words">
                      {seg.from_company || 'Отправитель не указан'}
                    </div>
                    <div className="text-sm text-slate-600 mt-1 break-words">
                      {[seg.from_postal_code, seg.from_city].filter(Boolean).join(', ') || '—'}
                    </div>
                    {seg.from_address && (
                      <div className="text-sm text-slate-600 mt-1 break-words">
                        {seg.from_address}
                      </div>
                    )}
                    {seg.from_country && (
                      <div className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" strokeWidth={2} />
                        {seg.from_country}
                      </div>
                    )}
                  </div>

                  {seg.stops.length > 0 && (
                    <div className="space-y-2">
                      {seg.stops.map((stop: StopDb, idx: number) => (
                        <div key={idx} className="border-l-4 border-amber-500 pl-3 py-1 ml-2">
                          <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold mb-1">
                            {stopTypeLabel[stop.type] || 'Остановка'}
                            {stop.date && ` · ${new Date(stop.date).toLocaleDateString('ru-RU')}`}
                          </div>
                          <div className="text-sm font-medium text-slate-800 break-words">
                            {stop.company || '—'}
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5 break-words">
                            {[stop.postal_code, stop.city, stop.country].filter(Boolean).join(', ') || '—'}
                          </div>
                          {stop.address && (
                            <div className="text-sm text-slate-600 mt-0.5 break-words">
                              {stop.address}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {(seg.to_city || seg.to_company || seg.to_country) && (
                    <div className="border-l-4 border-brand-500 pl-3 py-1">
                      <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1 inline-flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                        Выгрузка
                      </div>
                      <div className="font-bold text-slate-900 text-sm break-words">
                        {seg.to_company || 'Получатель не указан'}
                      </div>
                      <div className="text-sm text-slate-600 mt-1 break-words">
                        {[seg.to_postal_code, seg.to_city].filter(Boolean).join(', ') || '—'}
                      </div>
                      {seg.to_address && (
                        <div className="text-sm text-slate-600 mt-1 break-words">
                          {seg.to_address}
                        </div>
                      )}
                      {seg.to_country && (
                        <div className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" strokeWidth={2} />
                          {seg.to_country}
                        </div>
                      )}
                    </div>
                  )}

                  {seg.cargoLinks.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                      {seg.cargoLinks.map((cl) => (
                        <span
                          key={cl.cargo_id}
                          className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5"
                        >
                          <span className="font-bold text-brand-600 tabular-nums">#{cl.position}</span>
                          <span className="text-slate-700">{cl.label}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {segIdx < usSegments.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowRight className="w-4 h-4 text-slate-300 rotate-90" strokeWidth={2} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загрузить документы
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Загрузите CMR с отметкой о выгрузке, фото груза и другие рабочие документы.
          </p>
          <FileUpload tripId={tripId} />
        </div>

        {/* Загруженные документы */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загруженные файлы
          </h2>
          <DocumentList
            documents={documents || []}
            tripId={tripId}
            canDelete={true}
          />
        </div>

        {/* Расходы */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Расходы по рейсу
          </h2>

          {expenses?.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">Пока нет расходов</div>
          ) : (
            <div className="space-y-2">
              {expenses?.map((exp) => (
                <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold text-slate-800 text-sm flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      {categoryLabel(exp.category)}
                      {exp.paid_by_driver && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                          🚛 за счёт водителя
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 tabular-nums">
                        {exp.original_amount} {exp.currency}
                      </div>
                      <div className="font-bold text-red-500 text-sm tabular-nums">
                        {exp.amount_eur} €
                      </div>
                    </div>
                  </div>

                  {exp.description && (
                    <div className="text-xs text-slate-600 mb-2 break-words">
                      {exp.description}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="w-3 h-3" strokeWidth={2} />
                      {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <form action={async () => {
                      'use server';
                      await deleteExpense(exp.id, tripId);
                    }}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

              {/* Добавить расход */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Добавить расход
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Если вы оплатили из своих — поставьте галочку ниже. Сумма уйдёт в долг компании перед вами.
          </p>
          <AddExpenseForm
            tripId={tripId}
            hasDriver={true}
            allowSalary={false}
            defaultPaidByDriver={true}
            paidByDriverHint="Сумма уйдёт в долг компании перед вами. Офис увидит и сможет погасить."
          />
        </div>

      </div>
    </main>
  );
}
