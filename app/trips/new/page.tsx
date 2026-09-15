import { supabase } from '../../../lib/supabaseClient';
import { addTripWithAddress } from '../../geocode-actions';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: tractors } = await supabase.from('trucks').select('id, registration_number').eq('type', 'tractor');
  const { data: trailers } = await supabase.from('trucks').select('id, registration_number').eq('type', 'trailer');
  const { data: drivers } = await supabase.from('drivers').select('id, first_name, last_name');

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все рейсы
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Создать новый рейс</h1>
          <p className="text-slate-500 mt-1">Заполните данные для создания рейса</p>
        </div>

        <form action={addTripWithAddress} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚛 Основные данные</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelClass}>Клиент</label>
                <select name="client_id" className={inputClass}>
                  <option value="">Выберите клиента...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Тягач</label>
                <select name="truck_id" className={inputClass}>
                  <option value="">Выберите тягач...</option>
                  {tractors?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Прицеп</label>
                <select name="trailer_id" className={inputClass}>
                  <option value="">Без прицепа</option>
                  {trailers?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Водитель</label>
                <select name="driver_id" className={inputClass}>
                  <option value="">Выберите водителя...</option>
                  {drivers?.map(d => (
                    <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Дата старта</label>
                <input type="date" name="start_date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Фрахт (€)</label>
                <input type="number" name="revenue_eur" step="0.01" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Остаток топлива (л)</label>
                <input type="number" name="start_fuel_level" step="0.01" placeholder="Например, 200" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📄 Заявка клиента</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер заявки</label>
                <input type="text" name="client_request_number" placeholder="ZAM-2026-001" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата заявки</label>
                <input type="date" name="client_request_date" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📍 Отправитель (загрузка)</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Страна</label>
                <input type="text" name="sender_country" placeholder="Польша" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Название отправителя</label>
                <input type="text" name="sender_name" placeholder="ООО Пример" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input type="text" name="sender_postal_code" placeholder="00-001" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input type="text" name="sender_city" placeholder="Варшава" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Адрес</label>
                <input type="text" name="sender_address" placeholder="ул. Примерная, 1" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Погрузочный номер</label>
                <input type="text" name="sender_loading_number" placeholder="Ramp 4" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🏁 Получатель (выгрузка)</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Страна</label>
                <input type="text" name="receiver_country" placeholder="Беларусь" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Название получателя</label>
                <input type="text" name="receiver_name" placeholder="ООО Пример" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input type="text" name="receiver_postal_code" placeholder="220000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input type="text" name="receiver_city" placeholder="Брест" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Адрес</label>
                <input type="text" name="receiver_address" placeholder="ул. Советская, 1" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Погрузочный номер</label>
                <input type="text" name="receiver_loading_number" placeholder="Ramp 1" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]">
              ✅ Создать рейс
            </button>
            <a href="/trips" className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-all duration-150">
              Отмена
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
