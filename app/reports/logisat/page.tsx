import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RadioTower,
  AlertTriangle,
  XCircle,
  Clock,
  Gauge,
  Fuel,
  Truck,
  CheckCircle2,
  Inbox,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const STALE_DAYS = 7;

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

type TripRow = {
  id: string;
  trip_number: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  actual_km: number | null;
  actual_liters: number | null;
  logisat_synced_at: string | null;
  truck_id: string | null;
  truck_reg: string | null;
  client_name: string | null;
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function daysAgo(d: string | null): number | null {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

export default async function LogisatReportPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  // ============================================================
  // 1. ТЯГАЧИ
  // ============================================================
  const { data: trucks } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_enabled, logisat_device_id')
    .eq('type', 'tractor')
    .order('registration_number');

  const allTractors = trucks || [];
  const tractorsWithLogisat = allTractors.filter(
    (t) => t.logisat_enabled && t.logisat_device_id
  );
  const tractorsWithoutLogisat = allTractors.filter(
    (t) => !t.logisat_enabled || !t.logisat_device_id
  );

  const logisatTruckIds = new Set(tractorsWithLogisat.map((t) => t.id));

  // ============================================================
  // 2. РЕЙСЫ — только для тягачей с Logisat, только «боевые» статусы
  // ============================================================
  const { data: tripsRaw } = await supabase
    .from('trips')
    .select(`
      id, trip_number, status, start_date, end_date,
      actual_km, actual_liters, logisat_synced_at, truck_id,
      trucks!truck_id(registration_number),
      clients(name)
    `)
    .in('status', ['active', 'completed', 'invoiced', 'paid'])
    .not('truck_id', 'is', null)
    .order('trip_number', { ascending: false });

  const allTrips: TripRow[] = (tripsRaw || [])
    .filter((t: any) => logisatTruckIds.has(t.truck_id))
    .map((t: any) => {
      const truck = pickOne<{ registration_number: string | null }>(t.trucks);
      return {
        id: t.id,
        trip_number: t.trip_number ?? null,
        status: t.status,
        start_date: t.start_date ?? null,
        end_date: t.end_date ?? null,
        actual_km: t.actual_km ?? null,
        actual_liters: t.actual_liters ?? null,
        logisat_synced_at: t.logisat_synced_at ?? null,
        truck_id: t.truck_id,
        truck_reg: truck?.registration_number ?? null,
        client_name: pickName(t.clients) ?? null,
      };
    });

  // ============================================================
  // 3. КАТЕГОРИИ ПРОБЛЕМ
  // ============================================================
  const staleTs = Date.now() - STALE_DAYS * 86400000;

  const neverSynced: TripRow[] = [];
  const noOdometer: TripRow[] = [];
  const noFuel: TripRow[] = [];
  const staleActive: TripRow[] = [];

  for (const t of allTrips) {
    // A. Синк не выполнялся
    if (!t.logisat_synced_at) {
      neverSynced.push(t);
      continue; // не проверяем B/C/D для несинканных — бессмысленно
    }

    // B. Одометр не передаёт
    if (t.actual_km == null || t.actual_km === 0) {
      noOdometer.push(t);
    }

    // C. Топливо не передаёт
    if (t.actual_liters == null || t.actual_liters === 0) {
      noFuel.push(t);
    }

    // D. Синк устарел (только для активных рейсов)
    if (t.status === 'active' && new Date(t.logisat_synced_at).getTime() < staleTs) {
      staleActive.push(t);
    }
  }

  // ============================================================
  // ИТОГО
  // ============================================================
  const totalProblems =
    neverSynced.length + noOdometer.length + noFuel.length + staleActive.length;

  // ============================================================
  // UI-ХЕЛПЕР: карточка рейса
  // ============================================================
  function TripCard({ trip, hint }: { trip: TripRow; hint?: string }) {
    const syncedAgo = daysAgo(trip.logisat_synced_at);
    return (
      <Link
        href={`/trips/${trip.id}`}
        className="group block card card-hover overflow-hidden active:scale-[0.99]"
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                № {trip.trip_number || '—'}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 break-words group-hover:text-brand-600 transition-colors">
                {trip.client_name || 'Клиент не указан'}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
              ${trip.status === 'active' ? 'bg-brand-50 text-brand-700 border-brand-200' :
                trip.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                trip.status === 'invoiced' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
            {trip.truck_reg && (
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3 h-3" strokeWidth={2} />
                <b className="text-slate-700">{trip.truck_reg}</b>
              </span>
            )}
            <span className="tabular-nums">
              {fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" strokeWidth={2} />
              {trip.logisat_synced_at
                ? `синк ${syncedAgo !== null ? `${syncedAgo} дн. назад` : '—'}`
                : 'синка не было'}
            </span>
          </div>

          {hint && (
            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              {hint}
            </div>
          )}
        </div>
      </Link>
    );
  }

  function EmptySection() {
    return (
      <div className="card p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.8} />
        </div>
        <div className="text-sm text-slate-500">Проблем нет</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Навигация */}
        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Отчёты
        </a>

        {/* Заголовок */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <RadioTower className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Ошибки Logisat
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Проблемы синхронизации телеметрии с машин
          </p>
        </div>

        {/* KPI */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm font-medium text-slate-500 mb-2 md:mb-3">
              Тягачей всего
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
              {allTractors.length}
            </div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1 tabular-nums">
              с Logisat: {tractorsWithLogisat.length}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm font-medium text-slate-500 mb-2 md:mb-3">
              Рейсов проверено
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {allTrips.length}
            </div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1">
              с назначенным тягачом Logisat
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm font-medium text-slate-500 mb-2 md:mb-3">
              Синк успешен
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 tabular-nums">
              {allTrips.length - totalProblems}
            </div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1 tabular-nums">
              {allTrips.length > 0
                ? `${Math.round(((allTrips.length - totalProblems) / allTrips.length) * 100)}%`
                : '—'}
            </div>
          </div>

          <div className={`card p-4 md:p-5 ${totalProblems > 0 ? 'border-amber-200' : ''}`}>
            <div className="text-xs md:text-sm font-medium mb-2 md:mb-3 flex items-center gap-1.5
              ${totalProblems > 0 ? 'text-amber-700' : 'text-slate-500'}">
              {totalProblems > 0 && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" strokeWidth={2.2} />
              )}
              <span className={totalProblems > 0 ? 'text-amber-700' : 'text-slate-500'}>
                Проблем
              </span>
            </div>
            <div className={`text-2xl md:text-3xl font-bold tabular-nums ${totalProblems > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totalProblems}
            </div>
          </div>
        </div>

        {/* МАШИНЫ БЕЗ LOGISAT */}
        {tractorsWithoutLogisat.length > 0 && (
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-500" strokeWidth={2.2} />
              Тягачи без Logisat
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {tractorsWithoutLogisat.length}
              </span>
            </h2>
            <div className="card p-4">
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {tractorsWithoutLogisat.map((t) => (
                  <Link
                    key={t.id}
                    href={`/trucks/${t.id}`}
                    className="group flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm tabular-nums">
                        {t.registration_number}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {!t.logisat_enabled ? 'выключен' : 'нет deviceId'}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-brand-500 shrink-0 transition-colors" strokeWidth={2.2} />
                  </Link>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Рейсы этих машин не проверяются в отчёте. Включите Logisat в карточке машины.
              </p>
            </div>
          </div>
        )}

        {/* A. СИНК НЕ ВЫПОЛНЯЛСЯ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" strokeWidth={2.2} />
            Синк не выполнялся
            {neverSynced.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {neverSynced.length}
              </span>
            )}
          </h2>
          {neverSynced.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {neverSynced.map((t) => (
                <TripCard key={t.id} trip={t} hint="Рейс без единого синка — открыть и нажать «Logisat»" />
              ))}
            </div>
          )}
        </div>

        {/* D. СИНК УСТАРЕЛ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" strokeWidth={2.2} />
            Синк устарел
            <span className="text-xs text-slate-400 font-normal">
              · активные рейсы, синк &gt; {STALE_DAYS} дн.
            </span>
            {staleActive.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {staleActive.length}
              </span>
            )}
          </h2>
          {staleActive.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {staleActive.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  hint={`Последний синк: ${fmtDateTime(t.logisat_synced_at)}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* B. ОДОМЕТР НЕ ПЕРЕДАЁТ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-orange-500" strokeWidth={2.2} />
            Одометр не передаёт данные
            {noOdometer.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {noOdometer.length}
              </span>
            )}
          </h2>
          {noOdometer.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {noOdometer.map((t) => (
                <TripCard key={t.id} trip={t} hint="Пробег пустой — проверь CAN-модуль на машине" />
              ))}
            </div>
          )}
        </div>

        {/* C. ТОПЛИВО НЕ ПЕРЕДАЁТ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-red-400" strokeWidth={2.2} />
            Топливо не передаёт данные
            {noFuel.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {noFuel.length}
              </span>
            )}
          </h2>
          {noFuel.length === 0 ? (
            <EmptySection />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {noFuel.map((t) => (
                <TripCard key={t.id} trip={t} hint="Датчик топлива молчит — проверь CAN-модуль" />
              ))}
            </div>
          )}
        </div>

        {/* Всё чисто */}
        {allTrips.length > 0 && totalProblems === 0 && tractorsWithoutLogisat.length === 0 && (
          <div className="card p-10 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Проблем нет
            </h3>
            <p className="text-sm text-slate-500">
              Все рейсы синхронизированы, датчики работают, свежие данные.
            </p>
          </div>
        )}

        {/* Пусто */}
        {allTrips.length === 0 && tractorsWithoutLogisat.length === 0 && (
          <div className="card p-10 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Пока нет данных
            </h3>
            <p className="text-sm text-slate-500">
              Как только появятся рейсы с назначенными машинами — проверка начнётся автоматически.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
