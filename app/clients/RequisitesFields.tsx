import { getT } from '../../lib/i18n/server';

type Props = {
  values?: { tax_id?: string | null; street?: string | null; post_code?: string | null; city?: string | null; country?: string | null };
};

/** Реквизиты клиента для фактуры: NIP / VAT UE и адрес. */
export default async function RequisitesFields({ values = {} }: Props) {
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">{t('inv.requisites')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('inv.clTaxId')}</label>
          <input name="tax_id" defaultValue={values.tax_id ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('inv.clCountry')}</label>
          <input name="country" maxLength={2} defaultValue={values.country ?? ''} placeholder="PL" className="input uppercase" />
          <p className="text-xs text-slate-400 mt-1">{t('inv.clCountryHint')}</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('inv.clStreet')}</label>
          <input name="street" defaultValue={values.street ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('inv.clPostCode')}</label>
          <input name="post_code" defaultValue={values.post_code ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('inv.clCity')}</label>
          <input name="city" defaultValue={values.city ?? ''} className="input" />
        </div>
      </div>
    </div>
  );
}
