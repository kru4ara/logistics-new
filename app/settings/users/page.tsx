import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Users, UserPlus, CheckCircle2, AlertCircle, KeyRound, UserX, ShieldCheck, ShieldOff } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/session';
import { deniedRedirect, isOfficeRole } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { formatDateTime } from '../../../lib/i18n/format';
import type { MessageKey } from '../../../lib/i18n/translate';
import { isStaffProfile, STAFF_ROLES } from '../../../lib/staff-rules';
import { addStaff, setStaffRole, setStaffPassword, revokeStaff, resetStaffMfa, setRequireStaff2fa } from './actions';
import ConfirmSubmit from './ConfirmSubmit';

export const dynamic = 'force-dynamic';

const ROLE_KEY: Record<(typeof STAFF_ROLES)[number], MessageKey> = {
  office: 'staff.roleOffice',
  accountant: 'staff.roleAccountant',
};

const ERR_KEY: Record<string, MessageKey> = {
  name: 'staff.errName',
  email: 'staff.errEmail',
  password: 'staff.errPassword',
  role: 'staff.errRole',
  self: 'staff.errSelf',
  lastOffice: 'staff.errLastOffice',
  taken: 'staff.errTaken',
  migration: 'staff.needMigration',
  mfaSelfFirst: 'mfa.requireSelfFirst',
  demo: 'demo.blocked',
  mfaMigration: 'mfa.requireNeedMigration',
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; email?: string; msg?: string }>;
}) {
  const { role, userId } = await getSessionContext();
  const denied = deniedRedirect(role, 'settings.edit');
  if (denied) redirect(denied);
  const { ok, err, email: okEmail, msg } = await searchParams;
  const { t, locale } = await getT();

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .in('role', ['office', 'admin', 'accountant']);
  const staff = (profiles ?? []).filter((p) => isStaffProfile(p.role as string));
  const accounts = await Promise.all(
    staff.map(async (p) => {
      const { data } = await supabase.auth.admin.getUserById(p.id as string);
      const { data: f } = await supabase.auth.admin.mfa.listFactors({ userId: p.id as string });
      const mfa = (f?.factors ?? []).some((x) => x.status === 'verified');
      return { ...p, email: data.user?.email ?? '—', lastSignIn: data.user?.last_sign_in_at ?? null, mfa };
    }),
  );
  accounts.sort((a, b) => String(a.full_name ?? a.email).localeCompare(String(b.full_name ?? b.email)));

  const { data: cs } = await supabase.from('company_settings').select('require_staff_2fa').eq('id', 1).maybeSingle();
  const require2fa = Boolean((cs as { require_staff_2fa?: boolean } | null)?.require_staff_2fa);

  const errText = err ? (err === 'auth' ? t('staff.errAuth', { msg: msg ?? '' }) : ERR_KEY[err] ? t(ERR_KEY[err]) : err) : null;
  const okText =
    ok === 'added' ? t('staff.added', { email: okEmail ?? '' }) : ok === 'revoked' ? t('staff.revoked', { email: okEmail ?? '' }) : ok === 'mfaReset' ? t('mfa.resetDone', { email: okEmail ?? '' }) : ok ? t('staff.saved') : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <Link href="/settings" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('settings.title')}
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Users className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('staff.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">{t('staff.hint')}</p>
        </div>

        {okText && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} /> {okText}
          </div>
        )}
        {errText && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} /> {errText}
          </div>
        )}

        <div className="card divide-y divide-slate-100">
          {accounts.length === 0 && <div className="p-5 text-sm text-slate-500">{t('staff.empty')}</div>}
          {accounts.map((a) => {
            const me = a.id === userId;
            const current = isOfficeRole(a.role as string) ? 'office' : 'accountant';
            return (
              <div key={a.id as string} className="p-4 md:p-5 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {(a.full_name as string) || a.email}
                      {me && <span className="ml-2 text-xs font-medium text-brand-700">· {t('staff.you')}</span>}
                    </div>
                    <div className="text-sm text-slate-500">{a.email}</div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 font-semibold ${a.mfa ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {a.mfa ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      {a.mfa ? t('mfa.on') : t('mfa.off')}
                    </span>
                    ·
                    {a.lastSignIn ? t('staff.lastSignIn', { date: formatDateTime(a.lastSignIn, locale) }) : t('staff.never')}
                  </div>
                </div>
                {me ? (
                  <div className="text-sm text-slate-600">{t(ROLE_KEY[current])}</div>
                ) : (
                  <div className="flex flex-wrap gap-2 items-center">
                    <form action={setStaffRole} className="flex gap-2 items-center">
                      <input type="hidden" name="user_id" value={a.id as string} />
                      <select name="role" defaultValue={current} className="input py-1.5 text-sm">
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(ROLE_KEY[r])}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-secondary text-sm">{t('staff.changeRole')}</button>
                    </form>
                    <form action={setStaffPassword} className="flex gap-2 items-center">
                      <input type="hidden" name="user_id" value={a.id as string} />
                      <input type="password" name="password" minLength={8} required placeholder={t('staff.newPassword')} autoComplete="new-password" className="input py-1.5 text-sm w-40" />
                      <button type="submit" className="btn btn-secondary text-sm">
                        <KeyRound className="w-4 h-4" strokeWidth={2} />
                        {t('staff.setPassword')}
                      </button>
                    </form>
                    {a.mfa && (
                      <form action={resetStaffMfa}>
                        <input type="hidden" name="user_id" value={a.id as string} />
                        <ConfirmSubmit message={t('mfa.resetConfirm', { email: a.email })} className="btn btn-secondary text-sm">
                          <ShieldOff className="w-4 h-4" strokeWidth={2} />
                          {t('mfa.reset')}
                        </ConfirmSubmit>
                      </form>
                    )}
                    <form action={revokeStaff}>
                      <input type="hidden" name="user_id" value={a.id as string} />
                      <ConfirmSubmit message={t('staff.revokeConfirm', { email: a.email })} className="btn btn-danger text-sm">
                        <UserX className="w-4 h-4" strokeWidth={2} />
                        {t('staff.revoke')}
                      </ConfirmSubmit>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form action={setRequireStaff2fa} className="card p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="require" defaultChecked={require2fa} className="mt-1" />
            <span>
              <span className="font-semibold text-slate-900">{t('mfa.requireLabel')}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{t('mfa.requireHint')}</span>
            </span>
          </label>
          <button type="submit" className="btn btn-secondary text-sm">{t('mfa.save')}</button>
        </form>

        <form action={addStaff} className="card p-5 md:p-6 space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            {t('staff.add')}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('staff.name')}</span>
              <input name="full_name" required maxLength={120} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('staff.email')}</span>
              <input name="email" type="email" required className="input" autoComplete="off" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('staff.password')}</span>
              <input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('staff.role')}</span>
              <select name="role" defaultValue="accountant" className="input">
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_KEY[r])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn-primary">
            <UserPlus className="w-4 h-4" strokeWidth={2} />
            {t('staff.add')}
          </button>
        </form>
      </div>
    </main>
  );
}
