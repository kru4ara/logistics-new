'use client';

/**
 * Окна подтверждения и всплывающие сообщения CRM — вместо window.confirm /
 * window.alert браузера: в стиле приложения, на языке пользователя, удобно
 * на телефоне.
 *
 *   if (!(await confirmDialog(t('…'), { danger: true }))) return;
 *   notify(t('…'), 'error');
 *
 * <DialogHost /> подключён один раз в корневом layout.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useT } from './I18nProvider';

type ConfirmReq = { id: number; message: string; danger: boolean; confirmLabel?: string; resolve: (ok: boolean) => void };
type Note = { id: number; message: string; type: 'success' | 'error' | 'info' };

let seq = 0;
let showConfirm: ((r: ConfirmReq) => void) | null = null;
let pushNote: ((n: Note) => void) | null = null;

/** Спросить подтверждение. Без хоста (тесты, вне приложения) — браузерный confirm. */
export function confirmDialog(message: string, opts: { danger?: boolean; confirmLabel?: string } = {}): Promise<boolean> {
  if (!showConfirm) return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  return new Promise((resolve) =>
    showConfirm!({ id: ++seq, message, danger: opts.danger ?? false, confirmLabel: opts.confirmLabel, resolve }),
  );
}

/** Всплывающее сообщение на несколько секунд. */
export function notify(message: string | null | undefined, type: Note['type'] = 'info'): void {
  if (!message) return;
  if (!pushNote) {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  pushNote({ id: ++seq, message, type });
}

const NOTE_STYLE: Record<Note['type'], { cls: string; Icon: typeof Info }> = {
  success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
  error: { cls: 'border-red-200 bg-red-50 text-red-900', Icon: XCircle },
  info: { cls: 'border-slate-200 bg-white text-slate-900', Icon: Info },
};

export default function DialogHost() {
  const { t } = useT();
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    showConfirm = (r) =>
      setReq((cur) => {
        cur?.resolve(false); // новое окно поверх старого — старое считается отменённым
        return r;
      });
    pushNote = (n) => {
      setNotes((list) => [...list.slice(-3), n]);
      setTimeout(() => setNotes((list) => list.filter((x) => x.id !== n.id)), n.type === 'error' ? 8000 : 5000);
    };
    return () => {
      showConfirm = null;
      pushNote = null;
    };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        req.resolve(false);
        setReq(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req]);

  return (
    <>
      {req && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 p-4 animate-fade-in"
          onMouseDown={(e) => e.target === e.currentTarget && close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`dlg-${req.id}`}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft-lg animate-scale-in"
          >
            <div className="flex gap-3">
              {req.danger && (
                <div className="shrink-0 rounded-full bg-red-50 p-2 h-fit">
                  <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                </div>
              )}
              <p id={`dlg-${req.id}`} className="text-sm text-slate-800 whitespace-pre-line pt-1">
                {req.message}
              </p>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                {t('common.cancel')}
              </button>
              <button
                ref={okRef}
                type="button"
                className={`btn ${req.danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {req.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed z-[110] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96" aria-live="polite">
        {notes.map((n) => {
          const { cls, Icon } = NOTE_STYLE[n.type];
          return (
            <div key={n.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 shadow-soft-lg text-sm animate-slide-up ${cls}`}>
              <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 whitespace-pre-line break-words">{n.message}</span>
              <button
                type="button"
                aria-label={t('common.close')}
                className="shrink-0 opacity-60 hover:opacity-100"
                onClick={() => setNotes((list) => list.filter((x) => x.id !== n.id))}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
