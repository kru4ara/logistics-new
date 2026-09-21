import { createClient } from '../../../../lib/supabase-server';
import { updateTruck } from '../../../truck-actions';

export const dynamic = 'force-dynamic';

export default async function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;

  const supabase = await createClient();

  const { data: truck, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (error) return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4';
  const sectionTitleClass = 'text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href={`/trucks/${truckId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к карточке
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать машину</h1>
        </div>

        <form action={updateTruck.bind(null, truckId)} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚛 Основные данные</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Госномер *</label>
                <input
                  type="text"
                  name="registration_number"
                  required
                  defaultValue={truck.registration_number || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Тип</label>
                <select name="type" defaultValue={truck.type || 'tractor'} className={inputClass}>
                  <option value="tractor">Тягач</option>
                  <option value="trailer">Прицеп</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Номер прицепа</label>
                <input
                  type="text"
                  name="trailer_number"
                  defaultValue={truck.trailer_number || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Топливная карта</label>
                <input
                  type="text"
                  name="fuel_card_number"
                  defaultValue={truck.fuel_card_number || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🛡 Страховки</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Страховка ОС (до)</label>
                <input
                  type="date"
                  name="truck_insurance_expiry"
                  defaultValue={truck.truck_insurance_expiry || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Пограничная страховка РБ (до)</label>
                <input
                  type="date"
                  name="border_insurance_expiry"
                  defaultValue={truck.border_insurance_expiry || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🔧 Техосмотр и тахограф</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Техосмотр (до)</label>
                <input
                  type="date"
                  name="tech_inspection_expiry"
                  defaultValue={truck.tech_inspection_expiry || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Легализация тахографа (до)</label>
                <input
                  type="date"
                  name="tachograph_legalization_expiry"
                  defaultValue={truck.tachograph_legalization_expiry || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
            <a
              href={`/trucks/${truckId}`}
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
