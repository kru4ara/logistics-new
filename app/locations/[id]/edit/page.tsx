import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { updateLocation } from '../../actions';
import { EUROPEAN_COUNTRIES } from '../../../../lib/countries';
import SubmitButton from '../../../../components/SubmitButton';
import { ArrowLeft, MapPin, Globe, Save } from 'lucide-react';

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/locations"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все локации
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <MapPin className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать локацию
          </h1>
        </div>

        <form action={updateLocation.bind(null, id)} className="space-y-4 md:space-y-6">

          {/* ОСНОВНОЕ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Основные данные
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Короткое название *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={location.name || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Тип локации *
                </label>
                <select name="type" required className="input" defaultValue={location.type || 'both'}>
                  <option value="loading">Только погрузка</option>
                  <option value="unloading">Только выгрузка</option>
                  <option value="both">Универсальная</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название организации
                </label>
                <input
                  type="text"
                  name="company_name"
                  defaultValue={location.company_name || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Контактное лицо
                </label>
                <input
                  type="text"
                  name="contact_person"
                  defaultValue={location.contact_person || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* АДРЕС */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Адрес
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Страна
                </label>
                <select name="country" className="input" defaultValue={currentCountry}>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Почтовый код
                </label>
                <input
                  type="text"
                  name="postal_code"
                  defaultValue={location.postal_code || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Город
                </label>
                <input
                  type="text"
                  name="city"
                  defaultValue={location.city || ''}
                  className="input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Адрес
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={location.address || ''}
                  className="input"
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
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю изменения…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить изменения
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
