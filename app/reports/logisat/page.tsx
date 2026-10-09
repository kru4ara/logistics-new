import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  RadioTower,
  Truck,
  ExternalLink,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase-server';
import LogisatProblemsList, { type TripRow } from './LogisatProblemsList';

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

export default async function LogisatReportPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  // 1. ТЯГАЧИ
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

  // 2. РЕЙСЫ
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
    .order('start_date', { ascending: false, nullsFirst: false });

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

  // 3. КАТЕГОРИИ ПРОБЛЕМ
  const staleTs = Date.now() - STALE_DAYS * 86400000;

  const neverSyncedActive: TripRow[] = [];
  const neverSyncedArchive: TripRow[] = [];
  const noOdometer: TripRow[] = [];
  const noFuel: TripRow[] = [];
  const staleActive: TripRow[] = [];

  for (const t of allTrips) {
    if (!t.logisat_synced_at) {
      if (t.status === 'active') neverSyncedActive.push(t);
      else neverSyncedArchive.push(t);
      continue;
    }

    if (t.actual_km == null || t.actual_km === 0) noOdometer.push(t);
    if (t.actual_liters == null || t.actual_liters === 0) noFuel.push(t);

    if (t.status === 'active' && new Date(t.logisat_synced_at).getTime() < staleTs) {
      staleActive.push(t);
    }
  }

  const totalProblems =
    neverSyncedActive.length +
    neverSyncedArchive.length +
    noOdometer.length +
    noFuel.length +
    staleActive.length;

  const okCount = allTrips.length - totalProblems;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Отчёты
        </a>

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
              {okCount}
            </div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1 tabular-nums">
              {allTrips.length > 0
                ? `${Math.round((okCount / allTrips.length) * 100)}%`
                : '—'}
            </div>
          </div>

          <div className={`card p-4 md:p-5 ${totalProblems > 0 ? 'border-amber-200' : ''}`}>
            <div className="text-xs md:text-sm font-medium mb-2 md:mb-3">
              <span className={totalProblems > 0 ? 'text-amber-700' : 'text-slate-500'}>
                Проблем
              </span>
            </div>
            <div className={`text-2xl md:text-3xl font-bold tabular-nums ${totalProblems > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totalProblems}
            </div>
          </div>
        </div>

        {/* ТЯГАЧИ БЕЗ LOGISAT */}
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
                  <a
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
                  </a>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Рейсы этих машин не проверяются в отчёте. Включите Logisat в карточке машины.
              </p>
            </div>
          </div>
        )}

        {/* Секции проблем */}
        <LogisatProblemsList
          variant="active-never"
          items={neverSyncedActive}
          bulkSyncable
        />

        <LogisatProblemsList
          variant="stale"
          items={staleActive}
          bulkSyncable
        />

        <LogisatProblemsList
          variant="no-odometer"
          items={noOdometer}
        />

        <LogisatProblemsList
          variant="no-fuel"
          items={noFuel}
        />

        <LogisatProblemsList
          variant="archive-never"
          items={neverSyncedArchive}
        />

        {/* Всё чисто */}
        {allTrips.length > 0 && totalProblems === 0 && tractorsWithoutLogisat.length === 0 && (
          <div className="card p-10 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Проблем нет</h3>
            <p className="text-sm text-slate-500">
              Все рейсы синхронизированы, датчики работают, свежие данные.
            </p>
          </div>
        )}

        {/* Совсем пусто */}
        {allTrips.length === 0 && tractorsWithoutLogisat.length === 0 && (
          <div className="card p-10 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Пока нет данных</h3>
            <p className="text-sm text-slate-500">
              Как только появятся рейсы с назначенными машинами — проверка начнётся автоматически.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
