'use client';

import { useState } from 'react';
import {
  ClipboardList,
  Receipt,
  Package,
  Handshake,
  Check,
  Info,
  Download,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '../../components/I18nProvider';
import type { MessageKey } from '../../../lib/i18n/translate';

type ExportType = 'trips' | 'expenses' | 'forwarding' | 'clients';
type ExportFormat = 'xlsx' | 'csv';

const OPTIONS: { value: ExportType; label: string; Icon: LucideIcon; hint: string }[] = [
  {
    value: 'trips',
    label: 'rep.xlOrders',
    Icon: ClipboardList,
    hint: 'rep.xlOrdersH',
  },
  {
    value: 'expenses',
    label: 'rep.xlExp',
    Icon: Receipt,
    hint: 'rep.xlExpH',
  },
  {
    value: 'forwarding',
    label: 'rep.xlFwd',
    Icon: Package,
    hint: 'rep.xlFwdH',
  },
  {
    value: 'clients',
    label: 'rep.pfClients',
    Icon: Handshake,
    hint: 'rep.xlClientsH',
  },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; hint: string; Icon: LucideIcon }[] = [
  {
    value: 'xlsx',
    label: 'Excel (.xlsx)',
    hint: 'rep.xlXlsxH',
    Icon: FileSpreadsheet,
  },
  {
    value: 'csv',
    label: 'CSV (.csv)',
    hint: 'rep.xlCsvH',
    Icon: FileText,
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default function ExportForm() {
  const { t } = useT();
  const [type, setType] = useState<ExportType>('trips');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [from, setFrom] = useState(firstDayOfMonthIso);
  const [to, setTo] = useState(todayIso);

  const isPeriodless = type === 'clients';

  function handleDownload(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isPeriodless) return;
    if (from > to) {
      e.preventDefault();
      alert(t('rep.xlBadRange'));
    }
  }

  const href = isPeriodless
    ? `/api/export?type=${type}&format=${format}`
    : `/api/export?type=${type}&from=${from}&to=${to}&format=${format}`;

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="space-y-5">

      {/* Тип выгрузки */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-700 mb-2">{t('rep.xlWhat')}</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {OPTIONS.map(({ value, label: labelKey, Icon, hint: hintKey }) => {
            const label = t(labelKey as MessageKey);
            const hint = t(hintKey as MessageKey);
            const active = type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`text-left p-4 rounded-xl border-2 transition-all active:scale-[0.99]
                  ${active
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg
                    ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${active ? 'text-brand-700' : 'text-slate-800'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
                  </div>
                  {active && (
                    <Check className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Формат файла */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-700 mb-2">{t('rep.xlFormat')}</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {FORMAT_OPTIONS.map(({ value, label, hint: hintKey, Icon }) => {
            const hint = t(hintKey as MessageKey);
            const active = format === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                className={`text-left p-4 rounded-xl border-2 transition-all active:scale-[0.99]
                  ${active
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg
                    ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${active ? 'text-brand-700' : 'text-slate-800'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
                  </div>
                  {active && (
                    <Check className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Период */}
      {!isPeriodless && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">{t('rep.xlPeriod')}</h2>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className={labelClass}>{t('rep.dateFrom')}</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('rep.dateTo')}</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {t('rep.xlPeriodHint')}
          </p>
        </div>
      )}

      {isPeriodless && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('rep.xlSummaryA')}{' '}<b>{t('rep.xlAllTime')}</b>{t('rep.xlSummaryB')}</span>
        </div>
      )}

      {/* Кнопка */}
      <a
        href={href}
        onClick={handleDownload}
        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                   text-white font-semibold py-4 rounded-xl shadow-md shadow-emerald-600/20
                   transition-all active:scale-[0.98] text-base"
      >
        <Download className="w-5 h-5" />
        {t('rep.download')}{' '}{format === 'csv' ? '.csv' : '.xlsx'}
      </a>

    </div>
  );
}
