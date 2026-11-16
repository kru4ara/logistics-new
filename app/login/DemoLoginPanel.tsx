'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { Building2, Calculator, Briefcase, Truck, RotateCcw, Loader2, FlaskConical } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { login, type LoginState } from './actions';
import { resetDemoNow } from './demo-actions';
import type { MessageKey } from '../../lib/i18n/translate';
import { DEMO_ACCOUNTS, type DemoAccountKey } from '../../lib/demo/data';

const LOOK: Record<DemoAccountKey, { label: MessageKey; Icon: typeof Building2 }> = {
  office: { label: 'demo.asOffice', Icon: Building2 },
  accountant: { label: 'demo.asAccountant', Icon: Calculator },
  manager: { label: 'demo.asManager', Icon: Briefcase },
  driver: { label: 'demo.asDriver', Icon: Truck },
};
const ROLES = DEMO_ACCOUNTS.map((a) => ({ email: a.email, ...LOOK[a.key] }));

/** Вход в демо одной кнопкой (DEMO_MODE=1). Учётки и пароль — lib/demo/data.ts, lib/demo/mode.ts. */
export default function DemoLoginPanel({ password }: { password: string }) {
  const { t } = useT();
  const [state, formAction] = useFormState<LoginState, FormData>(login, null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 mb-6">
      <div className="flex items-center gap-2 font-bold text-amber-900">
        <FlaskConical className="w-4 h-4" strokeWidth={2.2} />
        {t('demo.title')}
      </div>
      <p className="text-xs text-amber-900/80">{t('demo.hint', { password })}</p>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map(({ email, label, Icon }) => (
          <form key={email} action={formAction}>
            <input type="hidden" name="login" value={email} />
            <input type="hidden" name="password" value={password} />
            <button type="submit" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 py-2.5 text-sm font-semibold text-slate-800">
              <Icon className="w-4 h-4 text-amber-700" strokeWidth={2.2} />
              {t(label)}
            </button>
          </form>
        ))}
      </div>
      {state?.error && <div className="text-xs text-red-600">{state.error}</div>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resetDemoNow();
            setMsg({ ok: r.ok, text: r.message });
          })
        }
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        {t('demo.reset')}
      </button>
      {msg && <div className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</div>}
    </div>
  );
}
