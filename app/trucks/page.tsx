import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import {
  Truck as TruckIcon,
  Container,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  BarChart3,
  Calendar,
  ArrowRight,
  Inbox,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function getDaysUntil(dateString: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getMinDays(truck: any) {
  const isTractor = truck.type === 'tractor';
  const dates = isTractor
    ? [
        truck.truck_insurance_expiry,
        truck.to_expiry,
        truck.tech_inspection_expiry,
        truck.border_insurance_expiry,
        truck.tachograph_calibration_expiry,
      ]
    : [
        truck.truck_insurance_expiry,
        truck.tech_inspection_expiry,
        truck.border_insurance_expiry,
        truck.customs_certificate_expiry,
      ];
  const filled = dates.filter(Boolean);
  if (filled.length === 0) return null;
  const days = filled.map((d) => getDaysUntil(d)).filter((d) => d !== null) as number[];
  if (days.length === 0) return null;
  return Math.min(...days);
}

function countFilledDocs(truck: any) {
  const isTractor = truck.type === 'tractor';
  const dates = isTractor
    ? [
        truck.truck_insurance_expiry,
        truck.to_expiry,
        truck.tech_inspection_expiry,
        truck.border_insurance_expiry,
        truck.tachograph_calibration_expiry,
      ]
    : [
        truck.truck_insurance_expiry,
        truck.tech_inspection_expiry,
        truck.border_insurance_expiry,
        truck.customs_certificate_expiry,
      ];
  return dates.filter(Boolean).length;
}

function countTotalDocs(truck: any) {
  return truck.type === 'tractor' ? 5 : 4;
}

export default async function TrucksPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*')
    .order('registration_number', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  // Считаем количество рейсов для каждой машины — и как тягач, и как прицеп
  const { data: allTrips } = await supabase
    .from('trips')
    .select('truck_id, trailer_id');

  const tripsCountByTruck: Record<string, number> = {};
  allTrips?.forEach((t) => {
    if (t.truck_id) {
      tripsCountByTruck[t.truck_id] = (tripsCountByTruck[t.truck_id] || 0) + 1;
    }
    if (t.trailer_id) {
      tripsCountByTruck[t.trailer_id] = (tripsCountByTruck[t.trailer_id] || 0) + 1;
    }
  });

  const tractors = trucks?.filter((t) => t.type === 'tractor') || [];
  const trailers = trucks?.filter((t) => t.type === 'trailer') || [];
  const hasAnyTrucks = (trucks?.length || 0) > 0;

  function TruckCard({ truck }: { truck: any }) {
    const minDays = getMinDays(truck);
    const isExpired = minDays !== null && minDays < 0;
    const isSoon = minDays !== null && minDays >= 0 && minDays < 30;

    const statusColor =
      minDays === null ? 'bg-slate-50 text-slate-600 border-slate-200' :
      isExpired ? 'bg-red-50 text-red-700 border-red-200' :
      isSoon ? 'bg-orange-50 text-orange-700 border-orange-200' :
      'bg-green-50 text-green-700 border-green-200';

    const StatusIcon =
      minDays === null ? Clock :
      isExpired ? AlertTriangle :
      isSoon ? Clock :
      CheckCircle2;

    const statusLabel =
      minDays === null ? 'Нет данных о документах' :
      isExpired ? `Просрочено (${Math.abs(minDays)} дн.)` :
      isSoon ? `${minDays} дн. до срока` :
      `OK (${minDays} дн.)`;

    const isTractor = truck.type === 'tractor';
    const TypeIcon = isTractor ? TruckIcon : Container;
    const typeLabel = isTractor ? 'Тягач' : 'Прицеп';

    const subtitleParts = [typeLabel];
    if (truck.brand) subtitleParts.push(truck.brand);
    if (truck.model) subtitleParts.push(truck.model);
    if (truck.year) subtitleParts.push(String(truck.year));
    const subtitle = subtitleParts.join(' · ');

    const tripsCount = tripsCountByTruck[truck.id] || 0;
    const filledDocs = countFilledDocs(truck);
    const totalDocs = countTotalDocs(truck);

    return (
      <a
        href={`/trucks/${truck.id}`}
        className="group card card-hover overflow-hidden"
      >
        <div className="p-4 md:p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500
                            flex items-center justify-center text-white shrink-0 shadow-brand">
              <TypeIcon className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate tabular-nums">
                {truck.registration_number?.trim() || '—'}
              </div>
              <div className="text-sm text-slate-500 truncate">
                {subtitle}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500
                                    group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2.5} />
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${statusColor}`}>
            <StatusIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            <span>{statusLabel}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">
                <FileText className="w-3 h-3" strokeWidth={2} />
                Документов
              </div>
              <div className={`text-xs sm:text-sm font-bold tabular-nums ${filledDocs === totalDocs ? 'text-emerald-600' : filledDocs > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                {filledDocs} / {totalDocs}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">
                <BarChart3 className="w-3 h-3" strokeWidth={2} />
                Рейсов
              </div>
              <div className={`text-xs sm:text-sm font-bold tabular-nums ${tripsCount > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                {tripsCount > 0 ? tripsCount : '—'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">
                <Calendar className="w-3 h-3" strokeWidth={2} />
                Год
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-700 tabular-nums">
                {truck.year || '—'}
              </div>
            </div>
          </div>
        </div>
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <TruckIcon className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Транспорт
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Тягачей: <b className="text-slate-700">{tractors.length}</b> · Прицепов: <b className="text-slate-700">{trailers.length}</b>
            </p>
          </div>
          <a href="/trucks/new" className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить транспорт
          </a>
        </div>

        {/* Полностью пусто — одна большая empty state */}
        {!hasAnyTrucks ? (
          <div className="card p-10 md:p-16 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
              <TruckIcon className="w-8 h-8 text-brand-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Транспорт не добавлен
            </h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Добавьте тягачи и прицепы, чтобы назначать их на рейсы
              и следить за сроками документов.
            </p>
            <a href="/trucks/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Добавить транспорт
            </a>
          </div>
        ) : (
          <>
            {/* Тягачи */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3 md:mb-4 flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
                Тягачи
                <span className="text-sm font-normal text-slate-400 tabular-nums">({tractors.length})</span>
              </h2>
              {tractors.length === 0 ? (
                <div className="card p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
                  </div>
                  <div className="text-slate-400 text-sm">Тягачей пока нет</div>
                </div>
              ) : (
                <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {tractors.map((truck) => <TruckCard key={truck.id} truck={truck} />)}
                </div>
              )}
            </div>

            {/* Прицепы */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3 md:mb-4 flex items-center gap-2">
                <Container className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
                Прицепы
                <span className="text-sm font-normal text-slate-400 tabular-nums">({trailers.length})</span>
              </h2>
              {trailers.length === 0 ? (
                <div className="card p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
                  </div>
                  <div className="text-slate-400 text-sm">Прицепов пока нет</div>
                </div>
              ) : (
                <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {trailers.map((truck) => <TruckCard key={truck.id} truck={truck} />)}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
