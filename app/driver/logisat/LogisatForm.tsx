'use client';

import { useState, useTransition } from 'react';
import { checkLogisat } from './actions';
import type { SummaryResult } from '../../../lib/logisat';

type Truck = { id: string; label: string; deviceId: string };

type Props = {
  trucks: Truck[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function formatRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export default function LogisatForm({ trucks }: Props) {
  const [deviceId, setDeviceId] = useState('');
  const [from, setFrom] = useState(firstDayOfMonthIso);
  const [to, setTo] = useState(todayIso);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setResult(null);

    if (!deviceId) {
      setLocalError('Выберите машину');
      return;
    }
    if (!from || !to) {
      setLocalError('Укажите период: с и по');
      return;
    }
    if (from > to) {
      setLocalError('Дата «с» позже даты «по»');
      return;
    }

    startTransition(async () => {
      try {
        const res = await checkLogisat(deviceId, from, to);
        setResult(res);
      } catch (err) {
        setLocalError((err as Error).message || 'Ошибка запроса к Logisat');
      }
    });
  }

  return (
    <div className="space-y-5">

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <label className={labelClass}>Машина</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className={inputClass}
          >
            <option value="">— Выберите машину —</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.deviceId}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Период с</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>по</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                     text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20
                     transition-all duration-150 active:scale-[0.98]"
        >
          {isPending ? '⏳ Запрашиваю…' : '📡 Проверить расход'}
        </button>

        {localError && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {localError}
          </div>
        )}
      </form>

      {result && !result.success && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
          <div className="text-red-600 font-bold mb-2">Не удалось получить данные</div>
          <div className="text-sm text-slate-700 break-words">{result.error}</div>
          {result.period && (
            <div className="text-xs text-slate-400 mt-2">
              Период: {formatRu(result.period.from.slice(0, 10))} → {formatRu(result.period.to.slice(0, 10))}
              {typeof result.framesCount === 'number' && ` · кадров: ${result.framesCount}`}
            </div>
          )}
        </div>
      )}

      {result && result.success && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 shadow-lg text-white">
            <div className="text-sm text-blue-200">Средний расход за период</div>
            <div className="text-4xl font-bold mt-1">
              {result.consumption != null ? `${result.consumption} л/100 км` : '—'}
            </div>
            {result.period && (
              <div className="text-xs text-blue-200 mt-2">
                {formatRu(result.period.from.slice(0, 10))} → {formatRu(result.period.to.slice(0, 10))}
                {' · '}
                {result.framesCount ?? 0} кадров
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Пробег</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.distanceKm != null ? `${result.distanceKm} км` : '—'}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Израсходовано</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.fuelLiters != null ? `${result.fuelLiters} л` : '—'}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Одометр на старте</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.startOdometer != null ? `${result.startOdometer} км` : '—'}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Одометр на финише</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.endOdometer != null ? `${result.endOdometer} км` : '—'}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 px-1">
            Данные Logisat. Если цифры кажутся неверными — сообщите в офис.
          </div>
        </div>
      )}

    </div>
  );
}
