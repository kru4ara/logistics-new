import { redirect } from 'next/navigation';
import { FileSpreadsheet, Building2, Landmark, ScrollText, Send, Stamp, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSessionContext } from '../../lib/session';
import { deniedRedirect } from '../../lib/roles';
import { createClient } from '../../lib/supabase/admin';
import { COMPANY_COLUMNS, isMissingTable, STAMP_PATH } from '../../lib/company';
import { TERM_PLACEHOLDERS, type CompanyRow } from '../../lib/company-rules';
import { signDocumentPaths } from '../../lib/storage-urls';
import SubmitButton from '../components/SubmitButton';
import { getT } from '../../lib/i18n/server';
import { saveCompanySettings } from './actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function Field({
  name, label, value, placeholder, hint, type = 'text',
}: {
  name: string; label: string; value: string | null | undefined;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} className="input" />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'settings.edit');
  if (denied) redirect(denied);

  const { saved, error: formError } = await searchParams;
  const { t } = await getT();

  const admin = await createClient();
  const { data, error } = await admin.from('company_settings').select(COMPANY_COLUMNS).eq('id', 1).maybeSingle();
  const migrationMissing = !!error && isMissingTable(error);
  const row = (data ?? null) as CompanyRow | null;

  const stampUrl = (await signDocumentPaths([STAMP_PATH]))[STAMP_PATH] ?? null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Building2 className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('settings.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {t('settings.subtitle')}
          </p>
          <Link href="/settings/import" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <FileSpreadsheet className="w-4 h-4" strokeWidth={2.2} />
            {t('imp.title')}
          </Link>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} /> {t('common.saved')}
          </div>
        )}
        {formError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} /> {formError}
          </div>
        )}
        {migrationMissing && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            {t('settings.migrationMissing')}
          </div>
        )}
        {!migrationMissing && !row && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            {t('settings.notConfigured')}
          </div>
        )}

        <form action={saveCompanySettings} className="space-y-4 md:space-y-6">
          <fieldset disabled={migrationMissing} className="space-y-4 md:space-y-6">
            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('settings.sectionCompany')}
              </h2>
              <Field name="name" label={t('settings.name')} value={row?.name} placeholder="EXAMPLE SP. Z O.O." hint={t('settings.nameHint')} />
              <Field name="short_name" label={t('settings.shortName')} value={row?.short_name} placeholder="EXAMPLE" hint={t('settings.shortNameHint')} />
              <Field name="address" label={t('settings.address')} value={row?.address} />
              <Field name="city" label={t('settings.city')} value={row?.city} hint={t('settings.cityHint')} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field name="nip" label="NIP" value={row?.nip} />
                <Field name="regon" label="REGON" value={row?.regon} />
                <Field name="eori" label="EORI" value={row?.eori} />
              </div>
              <Field name="email" label={t('settings.email')} type="email" value={row?.email} hint={t('settings.emailHint')} />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('settings.sectionBank')}
              </h2>
              <Field name="bank" label={t('settings.bank')} value={row?.bank} />
              <Field name="account_eur" label={t('settings.accountEur')} value={row?.account_eur} />
              <Field name="account_pln" label={t('settings.accountPln')} value={row?.account_pln} />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('settings.sectionTerms')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('settings.termsHelp')}{' '}
                {Object.entries(TERM_PLACEHOLDERS).map(([k, v], i) => (
                  <span key={k}>{i > 0 && ', '}<code className="text-slate-700">{k}</code> — {t(v)}</span>
                ))}
              </p>
              <textarea name="terms" rows={14} defaultValue={(row?.terms ?? []).join('\n')} className="input font-mono text-xs leading-relaxed" />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Stamp className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('settings.sectionStamp')}
              </h2>
              {stampUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stampUrl} alt={t('settings.stampAlt')} className="h-28 w-auto border border-slate-200 rounded-lg bg-white p-2" />
              ) : (
                <p className="text-sm text-slate-500">{t('settings.stampMissing')}</p>
              )}
              <input type="file" name="stamp" accept="image/png" className="block text-sm" />
              <p className="text-xs text-slate-400">{t('settings.stampHint')}</p>
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('settings.sectionTelegram')}
              </h2>
              <Field name="telegram_bot" label={t('settings.telegramBot')} value={row?.telegram_bot} placeholder="example_bot" hint={t('settings.telegramBotHint')} />
              <Field name="legacy_login_domain" label={t('settings.legacyDomain')} value={row?.legacy_login_domain} placeholder={t('settings.legacyDomainPlaceholder')} hint={t('settings.legacyDomainHint')} />
            </div>

            <SubmitButton>{t('common.save')}</SubmitButton>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
