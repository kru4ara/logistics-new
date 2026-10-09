import { createClient } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { syncReminders } from '../../reminder-actions';
import { logAudit } from '../../../lib/audit';
import SubmitButton from '../../components/SubmitButton';
import {
  ArrowLeft,
  UserPlus,
  User as UserIcon,
  FileText,
  Car,
  CreditCard,
  Save,
} from 'lucide-react';

async function createDriver(formData: FormData) {
  'use server';

  const supabase = await createClient();

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
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  if (data?.id) {
    await syncReminders('driver', data.id);

    await logAudit({
      entity_type: 'driver',
      entity_id: data.id,
      action: 'create',
      summary: `Создан водитель «${firstName} ${lastName}»`,
    });
  }

  revalidatePath('/drivers');
  redirect('/drivers?toast=driver_created');
}

export default function NewDriverPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/drivers"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все водители
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Добавить водителя
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Пароль выдаётся офисом отдельно. Для подключения Telegram — см. карточку водителя.
          </p>
        </div>

        <form action={createDriver} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Личные данные
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
                <input type="text" name="first_name" required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Фамилия (латиницей) *
                </label>
                <input type="text" name="last_name" required placeholder="VASILIUK" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                <input type="text" name="phone" placeholder="+375 29 123-45-67" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата рождения</label>
                <input type="date" name="date_of_birth" className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Адрес</label>
                <input type="text" name="address" placeholder="РБ, г. Кобрин, ул. ..." className="input" />
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Паспорт и виза
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Номер паспорта</label>
                <input type="text" name="passport_number" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия паспорта</label>
                <input type="date" name="passport_expiry" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия визы</label>
                <input type="date" name="visa_expiry" className="input" />
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Водительское удостоверение
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Номер прав</label>
                <input type="text" name="license_number" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия прав</label>
                <input type="date" name="license_expiry" className="input" />
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Дополнительные документы
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Номер карты тахографа</label>
                <input type="text" name="tachograph_card_number" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия карты тахографа</label>
                <input type="date" name="tachograph_card_expiry" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия Код 95</label>
                <input type="date" name="code_95_expiry" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия АДР</label>
                <input type="date" name="adr_expiry" className="input" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/drivers"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю водителя…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить водителя
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
