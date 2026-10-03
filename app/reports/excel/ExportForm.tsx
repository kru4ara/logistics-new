'use client';

import { useState } from 'react';

type ExportType = 'trips' | 'expenses' | 'forwarding' | 'clients';

const OPTIONS: { value: ExportType; label: string; icon: string; hint: string }[] = [
  {
    value: 'trips',
    label: 'Рейсы',
    icon: '📋',
    hint: 'Все рейсы с фрахтом, расходами и прибылью',
  },
  {
    value: 'expenses',
    label: 'Расходы по рейсам',
    icon: '💸',
    hint: 'Плоская таблица всех расходов',
  },
  {
    value: 'forwarding',
    label: 'Экспедирование',
    icon: '📦',
    hint: 'Заявки с маржой по подрядчикам',
  },
  {
    value: 'clients',
    label: 'Прибыльность клиентов',
    icon: '🤝',
    hint: 'Сводная: кто сколько приносит (за всё время)',
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
  const [type, setType] = useState<ExportType>('trips');
  const [from, setFrom] = useState(firstDayOfMonthIso);
  const [to, setTo] = useState(todayIso);

  const isPeriodless = type === 'clients';

  function handleDownload(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isPeriodless) return; // для clients — без параметров
    if (from > to) {
      e.preventDefault();
      alert('Дата «с» позже даты «по»');
    }
  }

  const href = isPeriodless
    ? `/api/export?type=${type}`
    : `/api/export?type=${type}&from=${from}&to=${to}`;

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="space-y-5">

      {/* Тип выгрузки */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Что выгрузить</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {OPTIONS.map((o) => {
            const active = type === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setType(o.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all
                  ${active
                    ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{o.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${active ? 'text-blue-700' : 'text-slate-800'}`}>
                      {o.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{o.hint}</div>
                  </div>
                  {active && (
                    <span className="text-blue-600 font-bold text-lg shrink-0">✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Период */}
      {!isPeriodless && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Период</h2>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className={labelClass}>С даты</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>По дату</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Для рейсов фильтр по дате старта, для расходов — по дате расхода, для экспедирования — по дате загрузки.
          </p>
        </div>
      )}

      {isPeriodless && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ℹ️ Сводный отчёт — считается <b>за всё время</b>, без фильтра по периоду.
        </div>
      )}

      {/* Кнопка */}
      <a
        href={href}
        onClick={handleDownload}
        className="block w-full text-center bg-emerald-600 hover:bg-emerald-700
                   text-white font-semibold py-4 rounded-xl shadow-md shadow-emerald-600/20
                   transition-all active:scale-[0.98] text-base"
      >
        📥 Скачать .xlsx
      </a>

    </div>
  );
}
