import { createLocation } from '../actions';

export const dynamic = 'force-dynamic';

export default function NewLocationPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href="/locations" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все локации
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить локацию</h1>
          <p className="text-slate-500 mt-1">Типовой адрес погрузки или выгрузки</p>
        </div>

        <form action={createLocation} className="space-y-6">
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📍 Данные локации</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Название (для списка) *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Например: Kamex Siedlce"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Тип *</label>
                <select name="type" required defaultValue="both" className={inputClass}>
                  <option value="loading">📍 Только погрузка</option>
                  <option value="unloading">🏁 Только выгрузка</option>
                  <option value="both">🔄 Универсальная</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input type="text" name="country" placeholder="Польша" className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Название компании</label>
                <input type="text" name="company_name" placeholder="Kamex Sp. z o.o." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input type="text" name="postal_code" placeholder="08-110" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input type="text" name="city" placeholder="Siedlce" className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input type="text" name="address" placeholder="Ul. Urzanow 275C" className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Погрузочный номер по умолчанию</label>
                <input type="text" name="default_loading_number" placeholder="777" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить локацию
            </button>
            <a
              href="/locations"
              className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
