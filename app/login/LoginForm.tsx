'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
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
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Вход…</span>
        </>
      ) : (
        <>
          <span>Войти</span>
          <span>→</span>
        </>
      )}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(login, null);

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base text-slate-900 ' +
    'placeholder:text-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white ' +
    'transition-all duration-150';

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Логин
        </label>
        <input
          name="login"
          autoComplete="username"
          autoFocus
          placeholder="office или фамилия"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Пароль
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      <div className="pt-1">
        <SubmitButton />
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        Если забыли пароль — обратитесь в офис
      </p>
    </form>
  );
}
