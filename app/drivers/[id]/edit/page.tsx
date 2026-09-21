import { createClient } from '../../../../lib/supabase-server';
import { updateDriver } from '../../../driver-actions';

export const dynamic = 'force-dynamic';

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;

  const supabase = await createClient();

  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
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

        <a href={`/drivers/${driverId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к карточке
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать водителя</h1>
        </div>

        <form action={updateDriver.bind(null, driverId)} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>👤 Личные данные</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Имя *</label>
                <input type="text" name="first_name" required defaultValue={driver.first_name || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Фамилия *</label>
                <input type="text" name="last_name" required defaultValue={driver.last_name || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input type="text" name="phone" defaultValue={driver.phone || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата рождения</label>
                <input type="date" name="date_of_birth" defaultValue={driver.date_of_birth || ''} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input type="text" name="address" defaultValue={driver.address || ''} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🛂 Паспорт и виза</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер паспорта</label>
                <input type="text" name="passport_number" defaultValue={driver.passport_number || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия паспорта</label>
                <input type="date" name="passport_expiry" defaultValue={driver.passport_expiry || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия визы</label>
                <input type="date" name="visa_expiry" defaultValue={driver.visa_expiry || ''} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚗 Водительское удостоверение</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер прав</label>
                <input type="text" name="license_number" defaultValue={driver.license_number || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия прав</label>
                <input type="date" name="license_expiry" defaultValue={driver.license_expiry || ''} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>💳 Дополнительные документы</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер карты тахографа</label>
                <input type="text" name="tachograph_card_number" defaultValue={driver.tachograph_card_number || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия карты тахографа</label>
                <input type="date" name="tachograph_card_expiry" defaultValue={driver.tachograph_card_expiry || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия Код 95</label>
                <input type="date" name="code_95_expiry" defaultValue={driver.code_95_expiry || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия АДР</label>
                <input type="date" name="adr_expiry" defaultValue={driver.adr_expiry || ''} className={inputClass} />
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
              href={`/drivers/${driverId}`}
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
