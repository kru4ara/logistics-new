import { createClient } from '../../../../lib/supabase/admin';
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
import { getT } from '../../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id: driverId } = await params;

  const supabase = await createClient();

  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (error) return <div className="p-8 text-red-500">{t('trip.loadError', { msg: error.message })}</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href={`/drivers/${driverId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('drv.backToCard')}
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('drv.editTitle')}
          </h1>
        </div>

        <form action={updateDriver.bind(null, driverId)} className="space-y-4 md:space-y-6">

          {/* ЛИЧНЫЕ ДАННЫЕ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('drv.personal')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.firstName')}</label>
                <input type="text" name="first_name" required defaultValue={driver.first_name || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.lastName')}</label>
                <input type="text" name="last_name" required defaultValue={driver.last_name || ''} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.phoneBy')}</label>
                <input
                  type="text"
                  name="phone_by"
                  defaultValue={driver.phone_by || ''}
                  placeholder="+375 ..."
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.phonePl')}</label>
                <input
                  type="text"
                  name="phone_pl"
                  defaultValue={driver.phone_pl || ''}
                  placeholder="+48 ..."
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.birthDate')}</label>
                <input type="date" name="date_of_birth" defaultValue={driver.date_of_birth || ''} className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.address')}</label>
                <input type="text" name="address" defaultValue={driver.address || ''} className="input" />
              </div>
            </div>
          </div>

          {/* ПАСПОРТ И ВИЗА */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('drv.passportVisa')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.passportSeries')}</label>
                <input
                  type="text"
                  name="passport_series"
                  defaultValue={driver.passport_series || ''}
                  placeholder="MP"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.passportNo')}</label>
                <input
                  type="text"
                  name="passport_number"
                  defaultValue={driver.passport_number || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.passportIssued')}</label>
                <input
                  type="date"
                  name="passport_issued_date"
                  defaultValue={driver.passport_issued_date || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.passportExpiry')}</label>
                <input
                  type="date"
                  name="passport_expiry"
                  defaultValue={driver.passport_expiry || ''}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.passportBy')}</label>
                <input
                  type="text"
                  name="passport_issued_by"
                  defaultValue={driver.passport_issued_by || ''}
                  placeholder={t('drv.phPassportBy')}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.visaExpiry')}</label>
                <input
                  type="date"
                  name="visa_expiry"
                  defaultValue={driver.visa_expiry || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('drv.licenseTitle')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.licenseNo')}</label>
                <input
                  type="text"
                  name="license_number"
                  defaultValue={driver.license_number || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.licenseExpiry')}</label>
                <input
                  type="date"
                  name="license_expiry"
                  defaultValue={driver.license_expiry || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* ДОПОЛНИТЕЛЬНЫЕ ДОКУМЕНТЫ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('drv.extraDocs')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.tachoNo')}</label>
                <input
                  type="text"
                  name="tachograph_card_number"
                  defaultValue={driver.tachograph_card_number || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.tachoExpiry')}</label>
                <input
                  type="date"
                  name="tachograph_card_expiry"
                  defaultValue={driver.tachograph_card_expiry || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.code95Expiry')}</label>
                <input
                  type="date"
                  name="code_95_expiry"
                  defaultValue={driver.code_95_expiry || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('drv.adrExpiry')}</label>
                <input
                  type="date"
                  name="adr_expiry"
                  defaultValue={driver.adr_expiry || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* СЧИТЫВАНИЕ КАРТЫ ВОДИТЕЛЯ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('drv.cardRead')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('drv.cardReadHint')}
            </p>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('drv.cardLast')}
                </label>
                <input
                  type="date"
                  name="driver_card_last_download"
                  defaultValue={driver.driver_card_last_download || ''}
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
              href={`/drivers/${driverId}`}
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              {t('seg.cancel')}
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText={t('tripForm.savingChanges')}
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              {t('tripForm.saveChanges')}
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
