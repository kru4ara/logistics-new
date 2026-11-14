'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { login, type LoginState } from './actions';
import { useT } from '../components/I18nProvider';

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed
                 text-white font-semibold py-3.5 rounded-xl
                 transition-all duration-150 shadow-lg shadow-slate-900/10
                 active:scale-[0.98] flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('login.submitting')}</span>
        </>
      ) : (
        <>
          <span>{t('login.submit')}</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export default function LoginForm() {
  const { t } = useT();
  const [state, formAction] = useFormState<LoginState, FormData>(login, null);

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base text-slate-900 ' +
    'placeholder:text-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white ' +
    'transition-all duration-150';

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t('login.login')}
        </label>
        <input
          name="login"
          autoComplete="username"
          autoFocus
          placeholder={t('login.loginPlaceholder')}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t('login.password')}
        </label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass}
          required
        />
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="pt-1">
        <SubmitButton />
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        {t('login.forgot')}
      </p>
    </form>
  );
}
