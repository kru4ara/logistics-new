import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteLocation } from './actions';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
    loading: { label: 'Погрузка', icon: '📤', color: 'bg-green-50 text-green-700 border-green-200' },
    unloading: { label: 'Выгрузка', icon: '📥', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    both: { label: 'Универсально', icon: '🔄', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📍 Локации</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего: <b>{locations?.length || 0}</b> типовых адресов
            </p>
          </div>
          <a
            href="/locations/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-4 md:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98] text-sm md:text-base"
          >
            <span>➕</span>
            <span>Добавить локацию</span>
          </a>
        </div>

        {locations?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-5xl md:text-6xl mb-4">📍</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Локаций пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте типовые адреса, чтобы не вводить их каждый раз</p>
            <a
              href="/locations/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl"
            >
              ➕ Добавить первую локацию
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => {
              const t = typeLabels[loc.type] || typeLabels.both;
              return (
                <div
                  key={loc.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5
                             hover:shadow-md transition-all flex flex-col"
                >
                  {/* Заголовок */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                      {t.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 break-words">
                        {loc.name}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${t.color}`}>
                        {t.label}
                      </span>
                    </div>
                  </div>

                  {/* Информация */}
                  <div className="space-y-2 text-sm text-slate-600 flex-1">
                    {loc.company_name && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">🏢</span>
                        <span className="font-medium text-slate-800 break-words">{loc.company_name}</span>
                      </div>
                    )}
                    {loc.contact_person && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">👤</span>
                        <span className="break-words">{loc.contact_person}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="shrink-0">🌍</span>
                      <span className="break-words">
                        {[loc.postal_code, loc.city, loc.address, loc.country].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    {loc.default_loading_number && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">🚪</span>
                        <span className="break-words">
                          Погрузка: <b>{loc.default_loading_number}</b>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Кнопки */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                    <a
                      href={`/locations/${loc.id}/edit`}
                      className="flex-1 text-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                 hover:bg-slate-100 transition-all"
                    >
                      ✏️ Изменить
                    </a>
                    <form action={deleteLocation.bind(null, loc.id)} className="flex-1">
                      <button
                        type="submit"
                        className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                      >
                        🗑️ Удалить
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
