import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { updateLocation } from '../../actions';
import { EUROPEAN_COUNTRIES } from '../../../../lib/countries';

export const dynamic = 'force-dynamic';

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: location, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !location) {
    return <div className="p-8 text-red-500">Локация не найдена</div>;
  }

  const currentCountry = location.country || '';
  const isKnownCountry = EUROPEAN_COUNTRIES.includes(currentCountry);

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/locations" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все локации
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">✏️ Редактировать локацию</h1>
        </div>

        <form action={updateLocation.bind(null, id)} className="space-y-4 md:space-y-6">

          {/* ОСНОВНОЕ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📍 Основные данные</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Короткое название *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={location.name || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Тип локации *</label>
                <select name="type" required className={inputClass} defaultValue={location.type || 'both'}>
                  <option value="loading">📤 Только погрузка</option>
                  <option value="unloading">📥 Только выгрузка</option>
                  <option value="both">🔄 Универсальная</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Название организации</label>
                <input
                  type="text"
                  name="company_name"
                  defaultValue={location.company_name || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Контактное лицо</label>
                <input
                  type="text"
                  name="contact_person"
                  defaultValue={location.contact_person || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* АДРЕС */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🌍 Адрес</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Страна</label>
                <select name="country" className={inputClass} defaultValue={currentCountry}>
                  <option value="">— Выберите страну —</option>

                  {!isKnownCountry && currentCountry && (
                    <option value={currentCountry}>{currentCountry} (текущая)</option>
                  )}

                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  name="postal_code"
                  defaultValue={location.postal_code || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  name="city"
                  defaultValue={location.city || ''}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={location.address || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* КНОПКИ */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/locations"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all"
            >
              Отмена
            </a>
            <button
              type="submit"
              className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
