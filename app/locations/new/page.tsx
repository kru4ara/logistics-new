import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import { createLocation } from '../actions';
import { EUROPEAN_COUNTRIES } from '../../../lib/countries';
import SubmitButton from '../../components/SubmitButton';
import { ArrowLeft, MapPin, Globe, Plus } from 'lucide-react';
import { deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewLocationPage() {
  const { t } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'locations.edit');
  if (denied) redirect(denied);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/locations"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('loc.all')}
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <MapPin className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('loc.newTitle')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {t('loc.newHint')}
          </p>
        </div>

        <form action={createLocation} className="space-y-4 md:space-y-6">

          {/* ОСНОВНОЕ */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('loc.main')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('loc.shortName')}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="KAMEX Siedlce"
                  className="input"
                />
                <p className="text-xs text-slate-400 mt-1">{t('loc.shortHint')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('loc.type')}
                </label>
                <select name="type" required className="input" defaultValue="both">
                  <option value="loading">{t('loc.onlyLoading')}</option>
                  <option value="unloading">{t('loc.onlyUnloading')}</option>
                  <option value="customs">{t('loc.typeCustoms')}</option>
                  <option value="both">{t('loc.universal')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('loc.orgName')}
                </label>
                <input
                  type="text"
                  name="company_name"
                  placeholder="KAMEX Sp. z o.o."
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('dir.contact')}
                </label>
                <input
                  type="text"
                  name="contact_person"
                  placeholder="Kamil Jastrzębski"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* АДРЕС */}
          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('settings.address')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('addr.country')}
                </label>
                <select name="country" className="input" defaultValue="">
                  <option value="">{t('dir.chooseCountry')}</option>
                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('addr.postal')}
                </label>
                <input
                  type="text"
                  name="postal_code"
                  placeholder="08-110"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('settings.city')}
                </label>
                <input
                  type="text"
                  name="city"
                  placeholder="Siedlce"
                  className="input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('settings.address')}
                </label>
                <input
                  type="text"
                  name="address"
                  placeholder="Ujrzanów 275C"
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
              href="/locations"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all"
            >
              {t('seg.cancel')}
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText={t('loc.creating')}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              {t('loc.create')}
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
