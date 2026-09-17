import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { deleteLocation } from './actions';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
    loading: { label: 'Погрузка', icon: '📍', color: 'bg-green-50 text-green-700 border-green-200' },
    unloading: { label: 'Выгрузка', icon: '🏁', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    both: { label: 'Универсально', icon: '🔄', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📍 Локации</h1>
            <p className="text-slate-500 mt-1">Типовые адреса погрузки и выгрузки — для быстрого создания рейсов</p>
          </div>
          <a
            href="/locations/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить локацию</span>
          </a>
        </div>

        {locations?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📍</div>
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
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {locations?.map((loc) => {
              const t = typeLabels[loc.type] || typeLabels.both;
              return (
                <div
                  key={loc.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                        {t.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{loc.name}</div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${t.color}`}>
                          {t.label}
                        </span>
                      </div>
                    </div>
                    <form action={async () => {
                      'use server';
                      await deleteLocation(loc.id);
                    }}>
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-sm p-1"
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </form>
                  </div>

                  <div className="text-sm text-slate-600 space-y-1 pt-3 border-t border-slate-100">
                    {loc.company_name && (
                      <div>🏢 <b>{loc.company_name}</b></div>
                    )}
                    <div className="truncate">
                      🌍 {[loc.postal_code, loc.city, loc.address, loc.country].filter(Boolean).join(', ') || '—'}
                    </div>
                    {loc.default_loading_number && (
                      <div>🚪 Погрузочный номер: {loc.default_loading_number}</div>
                    )}
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
