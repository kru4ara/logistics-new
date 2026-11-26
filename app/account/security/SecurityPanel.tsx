'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, ShieldOff, ShieldPlus } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import { startTotpEnroll, confirmTotpEnroll, disableTotp, type EnrollStart } from './actions';
import { confirmDialog } from '../../components/Dialogs';

export default function SecurityPanel({ enabled, canDisable }: { enabled: boolean; canDisable: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [enroll, setEnroll] = useState<EnrollStart | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setMessage(null);
      const r = await startTotpEnroll();
      if (!r.ok) setMessage({ ok: false, text: r.message ?? '' });
      else setEnroll(r);
    });

  const confirm = () =>
    start(async () => {
      if (!enroll?.factorId) return;
      const r = await confirmTotpEnroll(enroll.factorId, code);
      if (!r.ok) {
        setMessage({ ok: false, text: r.message ?? '' });
        return;
      }
      setEnroll(null);
      setCode('');
      setMessage({ ok: true, text: t('mfa.enabled') });
      router.refresh();
    });

  const disable = () =>
    start(async () => {
      if (!(await confirmDialog(t('mfa.disableConfirm'), { danger: true }))) return;
      const r = await disableTotp();
      setMessage(r.ok ? null : { ok: false, text: r.message ?? '' });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
        {enabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
        {enabled ? t('mfa.on') : t('mfa.off')}
      </div>

      {message && <div className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</div>}

      {!enabled && !enroll && (
        <button type="button" onClick={begin} disabled={pending} className="btn btn-primary">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldPlus className="w-4 h-4" />}
          {t('mfa.enable')}
        </button>
      )}

      {enroll?.ok && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-700">{t('mfa.step1')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR приходит от Supabase как data:image/svg+xml */}
          {enroll.qr && <img src={enroll.qr} alt="QR" width={180} height={180} className="bg-white rounded-lg border border-slate-100" />}
          <div className="text-xs text-slate-500">
            {t('mfa.secret')}: <code className="font-mono text-slate-800 break-all select-all">{enroll.secret}</code>
          </div>
          <p className="text-sm text-slate-700">{t('mfa.step2')}</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              className="input w-36 text-center text-lg tracking-[0.3em] tabular-nums"
              placeholder="••••••"
            />
            <button type="button" onClick={confirm} disabled={pending} className="btn btn-primary">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {t('mfa.confirm')}
            </button>
          </div>
        </div>
      )}

      {enabled && canDisable && (
        <button type="button" onClick={disable} disabled={pending} className="btn btn-secondary text-sm">
          <ShieldOff className="w-4 h-4" />
          {t('mfa.disable')}
        </button>
      )}
    </div>
  );
}
