'use client';

import { useState, useTransition } from 'react';

type Truck = { id: string; registration: string; deviceId: string };
type NotConnected = { id: string; registration: string };

type Result = {
  deviceId: string;
  success: boolean;
  error?: string;
  framesCount?: number;
  distanceKm?: number;
  fuelLiters?: number;
  consumption?: number;
  firstFrame?: any;
  lastFrame?: any;
  errors?: string[];
};

type Props = {
  connectedTrucks: Truck[];
  notConnectedTrucks: NotConnected[];
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function LogisatTestForm({ connectedTrucks, notConnectedTrucks }: Props) {
  const [from, setFrom] = useState(daysAgoStr(1));
  const [to, setTo] = useState(todayStr());
  const [selectedIds, setSelectedIds] = useState<string[]>(
    connectedTrucks.map((t) => t.deviceId)
  );
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<Result[] | null>(null);
  const [period, setPeriod] = useState<{ from: string; to: string; days: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleDevice(deviceId: string) {
    setSelectedIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  }

  function selectAll() {
    setSelectedIds(connectedTrucks.map((t) => t.deviceId));
  }

  function selectNone() {
    setSelectedIds([]);
  }

  function preset(days: number) {
    setFrom(daysAgoStr(days));
    setTo(todayStr());
  }

  async function handleQuery() {
    if (selectedIds.length === 0) {
      setError('Выберите хотя бы одну машину');
      return;
    }

    setError(null);
    setResults(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/logisat/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceIds: selectedIds, from, to }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error || 'Ошибка');
          return;
        }

        setResults(data.results);
        setPeriod(data.period);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function truckByDeviceId(deviceId: string): string {
    return connectedTrucks.find((t) => t.deviceId === deviceId)?.registration || deviceId;
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="space-y-5">

      {/* ФОРМА */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Параметры запроса</h2>

        {/* Период */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Дата с</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Дата по</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Пресеты */}
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Быстрый выбор</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => preset(0)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              Сегодня
            </button>
            <button type="button" onClick={() => preset(1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              2 дня
            </button>
            <button type="button" onClick={() => preset(3)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              3 дня
            </button>
            <button type="button" onClick={() => preset(7)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              7 дней
            </button>
            <button type="button" onClick={() => preset(14)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              14 дней
            </button>
            <button type="button" onClick={() => preset(30)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              30 дней
            </button>
          </div>
        </div>

        {/* Машины */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
              Машины с Logisat ({connectedTrucks.length})
            </div>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={selectAll} className="text-blue-600 hover:underline font-medium">
                Все
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={selectNone} className="text-blue-600 hover:underline font-medium">
                Ничего
              </button>
            </div>
          </div>

          {connectedTrucks.length === 0 ? (
            <div className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
              ⚠️ Нет машин с привязкой к Logisat
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedTrucks.map((t) => {
                const isSelected = selectedIds.includes(t.deviceId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleDevice(t.deviceId)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center
                      ${isSelected ? 'bg-white border-white' : 'border-slate-400'}`}>
                      {isSelected && <span className="text-blue-600 text-xs font-bold">✓</span>}
                    </span>
                    <span>{t.registration}</span>
                  </button>
                );
              })}
            </div>
          )}

          {notConnectedTrucks.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Без Logisat: {notConnectedTrucks.map((t) => t.registration).join(', ')}
            </div>
          )}
        </div>

        {/* Кнопка запроса */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleQuery}
          disabled={isPending || selectedIds.length === 0}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all
            ${isPending || selectedIds.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-[0.98]'}`}
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Запрашиваем Logisat...
            </>
          ) : (
            <>📡 Запросить данные</>
          )}
        </button>
      </div>

      {/* РЕЗУЛЬТАТЫ */}
      {results && period && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              Результаты ({results.length} машин)
            </h2>
            <div className="text-xs text-slate-500">
              Период: {period.from.split('T')[0]} → {period.to.split('T')[0]} · {period.days} дн.
            </div>
          </div>

          <div className="space-y-3">
            {results.map((r) => (
              <div
                key={r.deviceId}
                className={`rounded-2xl border p-4 md:p-5
                  ${r.success ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{r.success ? '✅' : '❌'}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-lg">
                        {truckByDeviceId(r.deviceId)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        deviceId: {r.deviceId}
                      </div>
                    </div>
                  </div>
                  {r.success && r.consumption !== undefined && (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border
                      ${r.consumption > 35 ? 'bg-red-100 text-red-700 border-red-200' :
                        r.consumption > 30 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        r.consumption > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {r.consumption > 0 ? `${r.consumption} л/100км` : 'нет данных'}
                    </div>
                  )}
                </div>

                {r.success ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-1">Пробег</div>
                        <div className="text-xl font-bold text-slate-900">{r.distanceKm}</div>
                        <div className="text-xs text-slate-500">км</div>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-1">Топливо</div>
                        <div className="text-xl font-bold text-slate-900">{r.fuelLiters}</div>
                        <div className="text-xs text-slate-500">л</div>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-1">Расход</div>
                        <div className="text-xl font-bold text-slate-900">{r.consumption}</div>
                        <div className="text-xs text-slate-500">л/100км</div>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-[10px] uppercase text-slate-400 font-medium mb-1">Кадров</div>
                        <div className="text-xl font-bold text-slate-900">{r.framesCount}</div>
                        <div className="text-xs text-slate-500">GPS</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="bg-white rounded-xl p-3 text-xs">
                        <div className="font-semibold text-slate-700 mb-1">🔵 Первый кадр</div>
                        <div className="text-slate-600">{r.firstFrame.time}</div>
                        <div className="text-slate-500 mt-1 font-mono">
                          {r.firstFrame.totaldistance} м · {r.firstFrame.totalfuel} мл
                        </div>
                        <div className="text-slate-400 mt-1">
                          🔋 {r.firstFrame.fuellevelperc}% · {r.firstFrame.ignitionState}
                        </div>
                        <div className="text-slate-400 mt-1">
                          📍 {r.firstFrame.lat?.toFixed(4)}, {r.firstFrame.lng?.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-3 text-xs">
                        <div className="font-semibold text-slate-700 mb-1">🔴 Последний кадр</div>
                        <div className="text-slate-600">{r.lastFrame.time}</div>
                        <div className="text-slate-500 mt-1 font-mono">
                          {r.lastFrame.totaldistance} м · {r.lastFrame.totalfuel} мл
                        </div>
                        <div className="text-slate-400 mt-1">
                          🔋 {r.lastFrame.fuellevelperc}% · {r.lastFrame.ignitionState}
                        </div>
                        <div className="text-slate-400 mt-1">
                          📍 {r.lastFrame.lat?.toFixed(4)}, {r.lastFrame.lng?.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {r.errors && r.errors.length > 0 && (
                      <div className="mt-3 text-xs text-orange-600 bg-orange-50 rounded-lg p-2">
                        ⚠️ {r.errors.join(' · ')}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-red-700 bg-white rounded-lg p-3">
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
