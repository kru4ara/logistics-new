'use client';

import { useState, useTransition } from 'react';
import {
  RadioTower,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
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

  const inputClass = 'input';
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

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
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
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Запрашиваю…
            </>
          ) : (
            <>
              <RadioTower className="w-4 h-4" />
              Проверить расход
            </>
          )}
        </button>

        {localError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{localError}</span>
          </div>
        )}
      </form>

      {result && !result.success && (
        <div className="card border-red-200 p-5">
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
        <div className="space-y-4 animate-fade-in">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 shadow-brand-lg text-white">
            <div className="text-sm text-brand-100">Средний расход за период</div>
            <div className="text-4xl font-bold mt-1">
              {result.consumption != null ? `${result.consumption} л/100 км` : '—'}
            </div>
            {result.period && (
              <div className="text-xs text-brand-100 mt-2">
                {formatRu(result.period.from.slice(0, 10))} → {formatRu(result.period.to.slice(0, 10))}
                {' · '}
                {result.framesCount ?? 0} кадров
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Пробег</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.distanceKm != null ? `${result.distanceKm} км` : '—'}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Израсходовано</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.fuelLiters != null ? `${result.fuelLiters} л` : '—'}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">Одометр на старте</div>
              <div className="text-2xl font-bold text-slate-800">
                {result.startOdometer != null ? `${result.startOdometer} км` : '—'}
              </div>
            </div>
            <div className="card p-4">
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
