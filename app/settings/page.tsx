import { redirect } from 'next/navigation';
import { Building2, Landmark, ScrollText, Send, Stamp, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSessionContext } from '../../lib/session';
import { deniedRedirect } from '../../lib/roles';
import { createClient } from '../../lib/supabase/admin';
import { COMPANY_COLUMNS, isMissingTable, STAMP_PATH } from '../../lib/company';
import { TERM_PLACEHOLDERS, type CompanyRow } from '../../lib/company-rules';
import { signDocumentPaths } from '../../lib/storage-urls';
import SubmitButton from '../components/SubmitButton';
import { saveCompanySettings } from './actions';

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
            Настройки компании
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Реквизиты и условия для заявок перевозчикам, страница входа, Telegram-бот
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} /> Сохранено
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
            Таблица настроек ещё не создана: примените миграцию 20261114_022_company_settings.sql.
            До этого заявки используют прежние реквизиты.
          </div>
        )}
        {!migrationMissing && !row && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            Компания ещё не настроена: заполните реквизиты — без них заявки выйдут пустыми.
          </div>
        )}

        <form action={saveCompanySettings} className="space-y-4 md:space-y-6">
          <fieldset disabled={migrationMissing} className="space-y-4 md:space-y-6">
            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" strokeWidth={2} /> Компания
              </h2>
              <Field name="name" label="Полное название *" value={row?.name} placeholder="EXAMPLE SP. Z O.O." hint="В шапке заявки и внизу страницы входа" />
              <Field name="short_name" label="Короткое название" value={row?.short_name} placeholder="EXAMPLE" hint="Крупно на странице входа" />
              <Field name="address" label="Адрес" value={row?.address} />
              <Field name="city" label="Город" value={row?.city} hint="Место составления заявки" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field name="nip" label="NIP" value={row?.nip} />
                <Field name="regon" label="REGON" value={row?.regon} />
                <Field name="eori" label="EORI" value={row?.eori} />
              </div>
              <Field name="email" label="E-mail" type="email" value={row?.email} hint="Подставляется в условия ({email}) — сюда перевозчик шлёт фактуру и CMR" />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-brand-600" strokeWidth={2} /> Банк
              </h2>
              <Field name="bank" label="Банк и SWIFT" value={row?.bank} />
              <Field name="account_eur" label="Счёт EUR" value={row?.account_eur} />
              <Field name="account_pln" label="Счёт PLN" value={row?.account_pln} />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-brand-600" strokeWidth={2} /> Условия перевозки
              </h2>
              <p className="text-xs text-slate-500">
                По одному пункту на строку. Подстановки:{' '}
                {Object.entries(TERM_PLACEHOLDERS).map(([k, v], i) => (
                  <span key={k}>{i > 0 && ', '}<code className="text-slate-700">{k}</code> — {v}</span>
                ))}
              </p>
              <textarea name="terms" rows={14} defaultValue={(row?.terms ?? []).join('\n')} className="input font-mono text-xs leading-relaxed" />
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Stamp className="w-5 h-5 text-brand-600" strokeWidth={2} /> Печать для заявок
              </h2>
              {stampUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stampUrl} alt="Печать" className="h-28 w-auto border border-slate-200 rounded-lg bg-white p-2" />
              ) : (
                <p className="text-sm text-slate-500">Печать не загружена — заявки выйдут без неё.</p>
              )}
              <input type="file" name="stamp" accept="image/png" className="block text-sm" />
              <p className="text-xs text-slate-400">PNG до 2 МБ, лучше с прозрачным фоном. Заменит текущую.</p>
            </div>

            <div className="card p-5 md:p-6 space-y-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-600" strokeWidth={2} /> Telegram и вход
              </h2>
              <Field name="telegram_bot" label="Имя Telegram-бота" value={row?.telegram_bot} placeholder="example_bot" hint="Без @. Для ссылок подключения водителей к уведомлениям" />
              <Field name="legacy_login_domain" label="Домен старых логинов" value={row?.legacy_login_domain} placeholder="не нужен для новых компаний" hint="Логин без e-mail превращается в «логин@домен». Оставьте пустым, если все входят по e-mail или фамилии" />
            </div>

            <SubmitButton>Сохранить</SubmitButton>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
