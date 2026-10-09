import { createClient } from '../../../../lib/supabase-server';
import { updateDriver } from '../../../driver-actions';
import SubmitButton from '../../../components/SubmitButton';
import {
  ArrowLeft,
  Pencil,
  User as UserIcon,
  FileText,
  Car,
  CreditCard,
  Save,
} from 'lucide-react';

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href={`/drivers/${driverId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Назад к карточке
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать водителя
          </h1>
        </div>

        <form action={updateDriver.bind(null, driverId)} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Личные данные
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
                <input type="text" name="first_name" required defaultValue={driver.first_name || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия *</label>
                <input type="text" name="last_name" required defaultValue={driver.last_name || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                <input type="text" name="phone" defaultValue={driver.phone || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата рождения</label>
                <input type="date" name="date_of_birth" defaultValue={driver.date_of_birth || ''} className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Адрес</label>
                <input type="text" name="address" defaultValue={driver.address || ''} className="input" />
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
                <input type="text" name="passport_number" defaultValue={driver.passport_number || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия паспорта</label>
                <input type="date" name="passport_expiry" defaultValue={driver.passport_expiry || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия визы</label>
                <input type="date" name="visa_expiry" defaultValue={driver.visa_expiry || ''} className="input" />
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
                <input type="text" name="license_number" defaultValue={driver.license_number || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия прав</label>
                <input type="date" name="license_expiry" defaultValue={driver.license_expiry || ''} className="input" />
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
                <input type="text" name="tachograph_card_number" defaultValue={driver.tachograph_card_number || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия карты тахографа</label>
                <input type="date" name="tachograph_card_expiry" defaultValue={driver.tachograph_card_expiry || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия Код 95</label>
                <input type="date" name="code_95_expiry" defaultValue={driver.code_95_expiry || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок действия АДР</label>
                <input type="date" name="adr_expiry" defaultValue={driver.adr_expiry || ''} className="input" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href={`/drivers/${driverId}`}
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
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
