'use client';

import { useActionState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { verifyMfaCode } from './actions';

export default function MfaVerifyForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState(verifyMfaCode, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t('mfa.code')}</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className="input text-center text-2xl tracking-[0.4em] tabular-nums"
          placeholder="••••••"
        />
      </label>
      {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {t('mfa.verify')}
      </button>
    </form>
  );
}
