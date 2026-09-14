import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function TrucksPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*')
    .order('registration_number', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getMinDays(truck: any) {
    const dates = [
      truck.truck_insurance_expiry,
      truck.tech_inspection_expiry,
      truck.border_insurance_expiry,
      truck.tachograph_legalization_expiry,
    ].filter(Boolean);
    if (dates.length === 0) return null;
    const days = dates.map((d) => getDaysUntil(d)).filter((d) => d !== null) as number[];
    return Math.min(...days);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🚚 Машины</h1>
            <p className="text-slate-500 mt-1">Всего единиц техники: {trucks?.length || 0}</p>
          </div>
          <a
            href="/trucks/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить машину</span>
          </a>
        </div>

        {/* Сетка */}
        {trucks?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">🚚</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Машин пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первую единицу техники</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trucks?.map((truck) => {
              const minDays = getMinDays(truck);
              const statusColor =
                minDays === null ? 'bg-slate-100 text-slate-600 border-slate-200' :
                minDays < 0 ? 'bg-red-50 text-red-700 border-red-200' :
                minDays < 30 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-green-50 text-green-700 border-green-200';
              const statusLabel =
                minDays === null ? 'Нет данных' :
                minDays < 0 ? `⚠️ Просрочено (${Math.abs(minDays)} дн.)` :
                minDays < 30 ? `⚡ ${minDays} дн. до срока` :
                `✅ OK (${minDays} дн.)`;

              const typeLabel = truck.type === 'tractor' ? 'Тягач' : truck.type === 'trailer' ? 'Прицеп' : truck.type;
              const typeIcon = truck.type === 'tractor' ? '🚛' : truck.type === 'trailer' ? '🚚' : '🚗';

              return (
                <a
                  key={truck.id}
                  href={`/trucks/${truck.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                             hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5
                             transition-all duration-200 overflow-hidden"
                >
                  <div className="p-5">
                    {/* Иконка и госномер */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700
                                      flex items-center justify-center text-white text-2xl shrink-0">
                        {typeIcon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {truck.registration_number}
                        </div>
                        <div className="text-sm text-slate-500">{typeLabel}</div>
                      </div>
                    </div>

                    {/* Статус документов */}
                    <div className={`px-3 py-2 rounded-xl text-xs font-semibold border ${statusColor}`}>
                      {statusLabel}
                    </div>

                    {/* Быстрые данные */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Страховка</div>
                        <div className="text-sm font-semibold text-slate-800">
                          {truck.truck_insurance_expiry ? new Date(truck.truck_insurance_expiry).toLocaleDateString('ru-RU') : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Техосмотр</div>
                        <div className="text-sm font-semibold text-slate-800">
                          {truck.tech_inspection_expiry ? new Date(truck.tech_inspection_expiry).toLocaleDateString('ru-RU') : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
