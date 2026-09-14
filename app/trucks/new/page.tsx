import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { syncReminders } from '../../reminder-actions';

async function createTruck(formData: FormData) {
  'use server';

  const registrationNumber = formData.get('registration_number') as string;
  const type = formData.get('type') as string;
  const trailerNumber = formData.get('trailer_number') as string;
  const truckInsuranceExpiry = formData.get('truck_insurance_expiry') as string;
  const techInspectionExpiry = formData.get('tech_inspection_expiry') as string;
  const borderInsuranceExpiry = formData.get('border_insurance_expiry') as string;
  const tachographLegalizationExpiry = formData.get('tachograph_legalization_expiry') as string;
  const fuelCardNumber = formData.get('fuel_card_number') as string;

  const { data, error } = await supabase
    .from('trucks')
    .insert([
      {
        registration_number: registrationNumber,
        type: type,
        trailer_number: trailerNumber || null,
        truck_insurance_expiry: truckInsuranceExpiry || null,
        tech_inspection_expiry: techInspectionExpiry || null,
        border_insurance_expiry: borderInsuranceExpiry || null,
        tachograph_legalization_expiry: tachographLegalizationExpiry || null,
        fuel_card_number: fuelCardNumber || null
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  // Создаём напоминания
  if (data?.id) {
    await syncReminders('truck', data.id);
  }

  revalidatePath('/trucks');
  redirect('/trucks');
}

export default function NewTruckPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href="/trucks" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все машины
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить машину</h1>
          <p className="text-slate-500 mt-1">Заполните данные о технике</p>
        </div>

        <form action={createTruck} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚛 Основные данные</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Госномер *</label>
                <input type="text" name="registration_number" required placeholder="WI042NM" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Тип *</label>
                <select name="type" required className={inputClass}>
                  <option value="tractor">Тягач</option>
                  <option value="trailer">Прицеп</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Номер прицепа</label>
                <input type="text" name="trailer_number" placeholder="Если есть" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Топливная карта</label>
                <input type="text" name="fuel_card_number" placeholder="Номер карты" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🛡 Страховки</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Страховка ОС (до)</label>
                <input type="date" name="truck_insurance_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Пограничная страховка РБ (до)</label>
                <input type="date" name="border_insurance_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🔧 Техосмотр и тахограф</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Техосмотр (до)</label>
                <input type="date" name="tech_inspection_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Легализация тахографа (до)</label>
                <input type="date" name="tachograph_legalization_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить машину
            </button>
            <a
              href="/trucks"
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
