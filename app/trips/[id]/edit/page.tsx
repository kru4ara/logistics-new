import { supabase } from '../../../../lib/supabaseClient';
import { updateTrip } from '../../../trip-actions';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { data: trip, error } = await supabase.from('trips').select('*').eq('id', tripId).single();
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: tractors } = await supabase.from('trucks').select('id, registration_number').eq('type', 'tractor');
  const { data: trailers } = await supabase.from('trucks').select('id, registration_number').eq('type', 'trailer');
  const { data: drivers } = await supabase.from('drivers').select('id, first_name, last_name');

  if (error) return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к рейсу
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать рейс №{trip.trip_number || '—'}</h1>
        </div>

        <form action={updateTrip.bind(null, tripId)} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚛 Основные данные</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelClass}>Клиент</label>
                <select name="client_id" defaultValue={trip.client_id || ''} className={inputClass}>
                  <option value="">Выберите клиента...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Тягач</label>
                <select name="truck_id" defaultValue={trip.truck_id || ''} className={inputClass}>
                  <option value="">Выберите тягач...</option>
                  {tractors?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Прицеп</label>
                <select name="trailer_id" defaultValue={trip.trailer_id || ''} className={inputClass}>
                  <option value="">Без прицепа</option>
                  {trailers?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Водитель</label>
                <select name="driver_id" defaultValue={trip.driver_id || ''} className={inputClass}>
                  <option value="">Выберите водителя...</option>
                  {drivers?.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Дата старта</label>
                <input type="date" name="start_date" defaultValue={trip.start_date?.split('T')[0] || ''} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Фрахт (€)</label>
                <input type="number" name="revenue_eur" step="0.01" defaultValue={trip.revenue_eur || 0} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Остаток топлива (л)</label>
                <input type="number" name="start_fuel_level" step="0.01" defaultValue={trip.start_fuel_level || 0} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📄 Заявка клиента</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер заявки</label>
                <input type="text" name="client_request_number" defaultValue={trip.client_request_number || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата заявки</label>
                <input type="date" name="client_request_date" defaultValue={trip.client_request_date || ''} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📍 Отправитель</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>Страна</label><input type="text" name="sender_country" defaultValue={trip.sender_country || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Название</label><input type="text" name="sender_name" defaultValue={trip.sender_name || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Почтовый код</label><input type="text" name="sender_postal_code" defaultValue={trip.sender_postal_code || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Город</label><input type="text" name="sender_city" defaultValue={trip.sender_city || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Адрес</label><input type="text" name="sender_address" defaultValue={trip.sender_address || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Погрузочный номер</label><input type="text" name="sender_loading_number" defaultValue={trip.sender_loading_number || ''} className={inputClass} /></div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🏁 Получатель</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>Страна</label><input type="text" name="receiver_country" defaultValue={trip.receiver_country || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Название</label><input type="text" name="receiver_name" defaultValue={trip.receiver_name || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Почтовый код</label><input type="text" name="receiver_postal_code" defaultValue={trip.receiver_postal_code || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Город</label><input type="text" name="receiver_city" defaultValue={trip.receiver_city || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Адрес</label><input type="text" name="receiver_address" defaultValue={trip.receiver_address || ''} className={inputClass} /></div>
              <div><label className={labelClass}>Погрузочный номер</label><input type="text" name="receiver_loading_number" defaultValue={trip.receiver_loading_number || ''} className={inputClass} /></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]">
              ✅ Сохранить изменения
            </button>
            <a href={`/trips/${tripId}`} className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-all duration-150">
              Отмена
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
