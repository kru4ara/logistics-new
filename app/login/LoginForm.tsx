'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                 text-white font-semibold py-2.5 rounded-lg
                 transition-all duration-150 shadow-md shadow-blue-600/20 active:scale-[0.98]"
    >
      {pending ? '⏳ Вход…' : 'Войти'}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState<LoginState>(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Логин</label>
        <input
          name="login"
          autoComplete="username"
          placeholder="office или фамилия"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-150"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-150"
          required
        />
      </div>
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
