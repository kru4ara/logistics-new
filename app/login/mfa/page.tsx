import { ShieldCheck } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';
import { logout } from '../actions';
import MfaVerifyForm from './MfaVerifyForm';

export const dynamic = 'force-dynamic';

/** Второй шаг входа (proxy.ts пускает сюда только с паролем, но без кода). */
export default async function MfaVerifyPage() {
  const { t } = await getT();
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-6 md:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{t('mfa.verifyTitle')}</h1>
          <p className="text-sm text-slate-500">{t('mfa.verifyHint')}</p>
        </div>
        <MfaVerifyForm />
        <p className="text-xs text-slate-400 text-center">{t('mfa.lostPhone')}</p>
        <form action={logout} className="text-center">
          <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            {t('mfa.logout')}
          </button>
        </form>
      </div>
    </main>
  );
}
