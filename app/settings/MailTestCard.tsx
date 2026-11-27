'use client';

import { useState, useTransition } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { sendTestMail } from './mail-actions';

/** Почта для писем клиентам: откуда уходят письма и проверка одной кнопкой. */
export default function MailTestCard({ from }: { from: string | null }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="card p-5 md:p-6 space-y-3">
      <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
        <Mail className="w-5 h-5 text-brand-600" strokeWidth={2} /> {t('mailTest.title')}
      </h2>
      {from ? (
        <p className="text-sm text-slate-600">
          {t('mailTest.from')} <b className="text-slate-900">{from}</b>
        </p>
      ) : (
        <p className="text-sm text-amber-700">{t('dun.noMail')}</p>
      )}
      <p className="text-xs text-slate-500">{t('mailTest.hint')}</p>
      <button
        type="button"
        disabled={!from || pending}
        onClick={() => start(async () => setRes(await sendTestMail()))}
        className="btn btn-secondary text-sm"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {t('mailTest.send')}
      </button>
      {res && (
        <p className={`flex items-start gap-1.5 text-sm break-words ${res.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {res.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          {res.message}
        </p>
      )}
    </div>
  );
}
