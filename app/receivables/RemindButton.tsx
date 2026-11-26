'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, X, Send } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { prepareReminder, sendReminder, type ReminderDraft } from './reminder-actions';
import { notify } from '../components/Dialogs';

export default function RemindButton({ clientId, clientName, lastSent }: { clientId: string; clientName: string; lastSent: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  const open = () =>
    startLoading(async () => {
      const d = await prepareReminder(clientId);
      if (!d.ok) {
        notify(d.message, 'error');
        return;
      }
      setDraft(d);
      setTo(d.to ?? '');
      setSubject(d.subject ?? '');
      setText(d.text ?? '');
      setAttachPdf((d.pdfCount ?? 0) > 0);
      setError(null);
    });

  const send = () =>
    startSending(async () => {
      setError(null);
      const res = await sendReminder(clientId, { to, subject, text, attachPdf });
      if (!res.ok) {
        setError(res.message ?? null);
        return;
      }
      setDraft(null);
      notify([t('dun.sent', { to }), res.warning].filter(Boolean).join('\n'), res.warning ? 'info' : 'success');
      router.refresh();
    });

  return (
    <>
      <span className="inline-flex items-center gap-2">
        {lastSent && <span className="text-xs text-slate-400">{t('dun.lastSent', { date: lastSent })}</span>}
        <button
          type="button"
          onClick={open}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" strokeWidth={2.2} />}
          {loading ? t('dun.loading') : t('dun.remind')}
        </button>
      </span>

      {draft && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => !sending && setDraft(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-soft-lg max-w-2xl w-full p-5 md:p-6 space-y-3 animate-scale-in max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
                {t('dun.remindTitle', { client: clientName })}
              </h3>
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={sending}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500 space-y-0.5">
              <div>
                {t('dun.from')}: <b className="text-slate-700">{draft.from}</b>
              </div>
              <div>{t('dun.letterLang', { lang: draft.langLabel ?? '' })}</div>
              {draft.bcc && <div>{t('dun.bccHint', { email: draft.bcc })}</div>}
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('dun.to')}</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} className="input" placeholder="buchhaltung@client.de" />
              <span className="text-xs text-slate-400">{to.trim() ? t('dun.toHint') : t('dun.noEmail')}</span>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('dun.subject')}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t('dun.body')}</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="input font-mono text-xs leading-relaxed" />
            </label>
            {(draft.pdfCount ?? 0) > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
                {t('dun.attachPdf', { n: draft.pdfCount ?? 0 })}
              </label>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDraft(null)} disabled={sending} className="btn btn-secondary">
                {t('seg.cancel')}
              </button>
              <button type="button" onClick={send} disabled={sending || !to.trim()} className="btn btn-primary">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? t('dun.sending') : t('dun.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
