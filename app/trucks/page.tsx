import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

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

  function TruckCard({ truck }: { truck: any }) {
    const minDays = getMinDays(truck);
    const statusColor =
      minDays === null ? 'bg-slate-100 text-slate-600 border-slate-200' :
      minDays < 0 ? 'bg-red-50 text-red-700 border-red-200' :
      minDays < 30 ? 'bg-orange-50 text-orange-700 border-orange-200' :
      'bg-green-50 text-green-700 border-green-200';
    const statusLabel =
      minDays === null ? 'Нет данных о документах' :
      minDays < 0 ? `⚠️ Просрочено (${Math.abs(minDays)} дн.)` :
      minDays < 30 ? `⚡ ${minDays} дн. до срока` :
      `✅ OK (${minDays} дн.)`;

    const isTractor = truck.type === 'tractor';
    const typeIcon = isTractor ? '🚛' : '🚚';
    const typeLabel = isTractor ? 'Тягач' : 'Прицеп';

    // Подзаголовок: "Тягач · DAF XF 480 FT · 2019"
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
        className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                   hover:shadow-xl hover:border-blue-200 md:hover:-translate-y-0.5
                   transition-all duration-200 overflow-hidden"
      >
        <div className="p-4 md:p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700
                            flex items-center justify-center text-white text-2xl shrink-0">
              {typeIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {truck.registration_number?.trim() || '—'}
              </div>
              <div className="text-sm text-slate-500 truncate">
                {subtitle}
              </div>
            </div>
          </div>

          <div className={`px-3 py-2 rounded-xl text-xs font-semibold border ${statusColor}`}>
            {statusLabel}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Документов</div>
              <div className={`text-xs sm:text-sm font-bold ${filledDocs === totalDocs ? 'text-emerald-600' : filledDocs > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                {filledDocs} / {totalDocs}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Рейсов</div>
              <div className={`text-xs sm:text-sm font-bold ${tripsCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                {tripsCount > 0 ? tripsCount : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Год</div>
              <div className="text-xs sm:text-sm font-bold text-slate-700">
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">🚚 Транспорт</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Тягачей: <b>{tractors.length}</b> · Прицепов: <b>{trailers.length}</b>
            </p>
          </div>
          <a
            href="/trucks/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-4 md:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98] text-sm md:text-base
                       w-full sm:w-auto"
          >
            <span>➕</span>
            <span>Добавить транспорт</span>
          </a>
        </div>

        {/* Тягачи */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3 md:mb-4 flex items-center gap-2">
            🚛 Тягачи <span className="text-sm font-normal text-slate-400">({tractors.length})</span>
          </h2>
          {tractors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
              Тягачей пока нет
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
            🚚 Прицепы <span className="text-sm font-normal text-slate-400">({trailers.length})</span>
          </h2>
          {trailers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
              Прицепов пока нет
            </div>
          ) : (
            <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {trailers.map((truck) => <TruckCard key={truck.id} truck={truck} />)}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
