import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { syncReminders } from '../../reminder-actions';

async function createDriver(formData: FormData) {
  'use server';

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phone = formData.get('phone') as string;
  const dateOfBirth = formData.get('date_of_birth') as string;
  const address = formData.get('address') as string;
  const passportNumber = formData.get('passport_number') as string;
  const passportExpiry = formData.get('passport_expiry') as string;
  const visaExpiry = formData.get('visa_expiry') as string;
  const licenseNumber = formData.get('license_number') as string;
  const licenseExpiry = formData.get('license_expiry') as string;
  const tachographCardNumber = formData.get('tachograph_card_number') as string;
  const tachographCardExpiry = formData.get('tachograph_card_expiry') as string;
  const code95Expiry = formData.get('code_95_expiry') as string;
  const adrExpiry = formData.get('adr_expiry') as string;

  const { data, error } = await supabase
    .from('drivers')
    .insert([
      {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        date_of_birth: dateOfBirth || null,
        address: address || null,
        passport_number: passportNumber || null,
        passport_expiry: passportExpiry || null,
        visa_expiry: visaExpiry || null,
        license_number: licenseNumber || null,
        license_expiry: licenseExpiry || null,
        tachograph_card_number: tachographCardNumber || null,
        tachograph_card_expiry: tachographCardExpiry || null,
        code_95_expiry: code95Expiry || null,
        adr_expiry: adrExpiry || null,
        password: '12345678'
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  // Автоматически создаём напоминания для документов
  if (data?.id) {
    await syncReminders('driver', data.id);
  }

  revalidatePath('/drivers');
  redirect('/drivers');
}

export default function NewDriverPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все водители
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить водителя</h1>
          <p className="text-slate-500 mt-1">Пароль по умолчанию: <b>12345678</b></p>
        </div>

        <form action={createDriver} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>👤 Личные данные</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Имя *</label>
                <input type="text" name="first_name" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Фамилия (латиницей) *</label>
                <input type="text" name="last_name" required placeholder="VASILIUK" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input type="text" name="phone" placeholder="+375 29 123-45-67" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата рождения</label>
                <input type="date" name="date_of_birth" className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input type="text" name="address" placeholder="РБ, г. Кобрин, ул. ..." className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🛂 Паспорт и виза</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер паспорта</label>
                <input type="text" name="passport_number" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия паспорта</label>
                <input type="date" name="passport_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия визы</label>
                <input type="date" name="visa_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🚗 Водительское удостоверение</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер прав</label>
                <input type="text" name="license_number" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия прав</label>
                <input type="date" name="license_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>💳 Дополнительные документы</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер карты тахографа</label>
                <input type="text" name="tachograph_card_number" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия карты тахографа</label>
                <input type="date" name="tachograph_card_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия Код 95</label>
                <input type="date" name="code_95_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Срок действия АДР</label>
                <input type="date" name="adr_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить водителя
            </button>
            <a
              href="/drivers"
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
