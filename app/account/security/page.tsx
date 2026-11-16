import { redirect } from 'next/navigation';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { createClient } from '../../../lib/supabase/server';
import { createClient as createAdminClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/session';
import { isDriverRole } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import SecurityPanel from './SecurityPanel';

export const dynamic = 'force-dynamic';

/** Своя 2FA: подключить / отключить. Открыта любой роли (lib/roles.ts → /account). */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const { userId, role } = await getSessionContext();
  if (!userId) redirect('/login');
  const { required } = await searchParams;
  const { t } = await getT();

  const supabase = await createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  const enabled = (list?.totp ?? []).some((f) => f.status === 'verified');
  const admin = await createAdminClient();
  const { data: companyRequires } = await admin.rpc('staff_2fa_required');
  const canDisable = !(companyRequires === true && !isDriverRole(role));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[640px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('mfa.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">{t('mfa.about')}</p>
        </div>
        {required && !enabled && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2} /> {t('mfa.required')}
          </div>
        )}
        <div className="card p-5 md:p-6">
          <SecurityPanel enabled={enabled} canDisable={canDisable} />
        </div>
      </div>
    </main>
  );
}
