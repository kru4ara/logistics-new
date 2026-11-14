'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, Users, UserCircle, Truck } from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import type { ImportError, ImportType } from '../../../lib/import-rules';
import type { MessageKey } from '../../../lib/i18n/translate';
import { checkImport, runImport, type ImportReport } from './actions';

const ICON = { clients: Users, drivers: UserCircle, trucks: Truck } as const;
const TITLE: Record<ImportType, MessageKey> = { clients: 'imp.clients', drivers: 'imp.drivers', trucks: 'imp.trucks' };
const ERROR_TEXT: Record<ImportError['code'], MessageKey> = {
  required: 'imp.eRequired',
  date: 'imp.eDate',
  int: 'imp.eInt',
  type: 'imp.eType',
  duplicateFile: 'imp.eDupFile',
  exists: 'imp.eExists',
};
const SHOW_ERRORS = 15;

export default function ImportCard({ type, labels }: { type: ImportType; labels: Record<string, string> }) {
  const { t } = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<'check' | 'import' | null>(null);
  const Icon = ICON[type];

  function send(kind: 'check' | 'import') {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setStage(kind);
    startTransition(async () => {
      const res = kind === 'check' ? await checkImport(type, fd) : await runImport(type, fd);
      setReport(res);
      setStage(null);
      if (kind === 'import' && res.ok) router.refresh();
    });
  }

  const errText = (e: ImportError) =>
    t(ERROR_TEXT[e.code], { field: e.field ? labels[e.field] ?? e.field : '' });

  return (
    <div className="card p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t(TITLE[type])}
        </h2>
        <a href={`/api/import/template?type=${type}`} className="btn btn-secondary text-sm">
          <Download className="w-4 h-4" strokeWidth={2} />
          {t('imp.template')}
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-secondary text-sm">
          <Upload className="w-4 h-4" strokeWidth={2} />
          {file ? file.name : t('imp.chooseFile')}
        </button>
        <button
          type="button"
          onClick={() => send('check')}
          disabled={!file || isPending}
          className="btn btn-primary text-sm disabled:opacity-50"
        >
          {stage === 'check' && <Loader2 className="w-4 h-4 animate-spin" />}
          {stage === 'check' ? t('imp.checking') : t('imp.check')}
        </button>
      </div>

      {report && !report.ok && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{report.message}</span>
        </div>
      )}

      {report && report.ok && (
        <div className="space-y-3">
          {report.added !== undefined ? (
            <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('imp.done', { n: report.added })}</span>
            </div>
          ) : (
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
              {t('imp.summary', { total: report.total, ok: report.toAdd, skip: report.total - report.toAdd })}
            </div>
          )}

          {report.errors.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {report.errors.slice(0, SHOW_ERRORS).map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold text-slate-800 shrink-0">{t('imp.row', { n: e.row })}:</span>
                  <span className={e.code === 'exists' || e.code === 'duplicateFile' ? 'text-slate-500' : 'text-red-600'}>
                    {errText(e)}
                  </span>
                </li>
              ))}
              {report.errors.length > SHOW_ERRORS && (
                <li className="text-slate-400">{t('imp.moreErrors', { n: report.errors.length - SHOW_ERRORS })}</li>
              )}
            </ul>
          )}

          {report.added === undefined &&
            (report.toAdd > 0 ? (
              <button
                type="button"
                onClick={() => send('import')}
                disabled={isPending}
                className="btn btn-primary text-sm disabled:opacity-50"
              >
                {stage === 'import' && <Loader2 className="w-4 h-4 animate-spin" />}
                {stage === 'import' ? t('imp.importing') : t('imp.importN', { n: report.toAdd })}
              </button>
            ) : (
              <p className="text-sm text-slate-500">{t('imp.nothing')}</p>
            ))}
        </div>
      )}
    </div>
  );
}
