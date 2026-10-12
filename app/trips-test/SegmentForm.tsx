'use client';

import { useState, useTransition } from 'react';
import {
  Truck,
  Users,
  X,
  Check,
  Loader2,
  Package,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { createSegment, updateSegment } from './segment-actions';

type Option = { id: string; label: string };

type CargoOption = {
  id: string;
  position: number;
  label: string;
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
};

type SegmentData = {
  id?: string;
  executor_type: string;
  contractor_id: string | null;
  truck_id: string | null;
  driver_id: string | null;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
};

function fmtPlace(company: string | null, city: string | null, country: string | null): string {
  const parts = [company, city, country].filter(Boolean);
  return parts.join(', ') || '—';
}

function keyFromTo(c: CargoOption): string {
  return [
    c.from_company || '', c.from_city || '', c.from_country || '',
    c.to_company || '', c.to_city || '', c.to_country || '',
  ].join('|');
}

export default function SegmentForm({
  tripId,
  segmentId,
  initialData,
  initialCargoIds,
  contractors,
  trucks,
  drivers,
  cargoList,
  onClose,
  onSaved,
}: {
  tripId: string;
  segmentId?: string;
  initialData?: Partial<SegmentData>;
  initialCargoIds?: string[];
  contractors: Option[];
  trucks: Option[];
  drivers: Option[];
  cargoList: CargoOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(segmentId);

  const [executorType, setExecutorType] = useState<'us' | 'contractor'>(
    (initialData?.executor_type as 'us' | 'contractor') || 'us'
  );
  const [contractorId, setContractorId] = useState(initialData?.contractor_id || '');
  const [truckId, setTruckId] = useState(initialData?.truck_id || '');
  const [driverId, setDriverId] = useState(initialData?.driver_id || '');
  const [dateFrom, setDateFrom] = useState(initialData?.date_from || '');
  const [dateTo, setDateTo] = useState(initialData?.date_to || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [selectedCargo, setSelectedCargo] = useState<Set<string>>(
    new Set(initialCargoIds || [])
  );

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  function toggleCargo(id: string) {
    setSelectedCargo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (executorType === 'contractor' && !contractorId) {
      setError('Выберите подрядчика');
      return;
    }

    if (selectedCargo.size === 0) {
      setError('Выберите хотя бы один груз для этого участка');
      return;
    }

    const formData = new FormData();
    formData.set('executor_type', executorType);
    formData.set('contractor_id', contractorId);
    formData.set('truck_id', truckId);
    formData.set('driver_id', driverId);
    formData.set('date_from', dateFrom);
    formData.set('date_to', dateTo);
    formData.set('notes', notes.trim());

    selectedCargo.forEach((cid) => formData.append('cargo_ids', cid));

    startTransition(async () => {
      try {
        if (isEdit && segmentId) {
          await updateSegment(segmentId, tripId, formData);
        } else {
          await createSegment(tripId, formData);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message || 'Ошибка сохранения');
      }
    });
  }

  // Выбранные грузы
  const selectedCargos = cargoList.filter((c) => selectedCargo.has(c.id));

  // Уникальные точки забора (по ключу)
  const uniqueFroms = (() => {
    const map = new Map<string, CargoOption>();
    for (const c of selectedCargos) {
      const fromKey = `${c.from_company || ''}|${c.from_city || ''}|${c.from_country || ''}|${c.from_address || ''}|${c.from_postal_code || ''}`;
      if (!map.has(fromKey) && (c.from_city || c.from_country || c.from_company || c.from_address)) {
        map.set(fromKey, c);
      }
    }
    return Array.from(map.values());
  })();

  // Уникальные точки доставки
  const uniqueTos = (() => {
    const map = new Map<string, CargoOption>();
    for (const c of selectedCargos) {
      const toKey = `${c.to_company || ''}|${c.to_city || ''}|${c.to_country || ''}|${c.to_address || ''}|${c.to_postal_code || ''}`;
      if (!map.has(toKey) && (c.to_city || c.to_country || c.to_company || c.to_address)) {
        map.set(toKey, c);
      }
    }
    return Array.from(map.values());
  })();

  const multiFrom = uniqueFroms.length > 1;
  const multiTo = uniqueTos.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-soft-lg max-w-2xl w-full my-8 p-5 md:p-6 space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            {isEdit ? 'Редактировать участок' : 'Добавить участок'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* КТО ЕДЕТ */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700">Кто везёт</h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExecutorType('us')}
                className={`text-left p-3 rounded-lg border-2 transition-all active:scale-[0.98]
                  ${executorType === 'us'
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Truck className={`w-4 h-4 ${executorType === 'us' ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={2.2} />
                  <span className={`font-semibold text-sm ${executorType === 'us' ? 'text-brand-700' : 'text-slate-700'}`}>
                    Наша машина
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExecutorType('contractor')}
                className={`text-left p-3 rounded-lg border-2 transition-all active:scale-[0.98]
                  ${executorType === 'contractor'
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${executorType === 'contractor' ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={2.2} />
                  <span className={`font-semibold text-sm ${executorType === 'contractor' ? 'text-brand-700' : 'text-slate-700'}`}>
                    Подрядчик
                  </span>
                </div>
              </button>
            </div>

            {executorType === 'contractor' && (
              <div>
                <label className={labelClass}>Подрядчик *</label>
                <select
                  value={contractorId}
                  onChange={(e) => setContractorId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">— Выберите подрядчика —</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            {executorType === 'us' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Машина</label>
                  <select
                    value={truckId}
                    onChange={(e) => setTruckId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Не указана —</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Водитель</label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Не указан —</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Дата с</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Дата по</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ГРУЗЫ */}
          {cargoList.length > 0 && (
            <div className="bg-brand-50 rounded-xl p-4 space-y-3 border border-brand-200">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-700" strokeWidth={2.2} />
                <h4 className="text-sm font-bold text-brand-800">Какие грузы везёт этот участок</h4>
              </div>

              <div className="space-y-1.5">
                {cargoList.map((c) => {
                  const isChecked = selectedCargo.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors
                        ${isChecked ? 'bg-white border-brand-400' : 'bg-white/60 border-brand-100 hover:border-brand-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCargo(c.id)}
                        className="w-4 h-4 accent-brand-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded tabular-nums">
                        {c.position}
                      </span>
                      <span className="text-sm text-slate-800 break-words flex-1">
                        {c.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* АВТОМАТИЧЕСКИЙ МАРШРУТ УЧАСТКА */}
          {selectedCargos.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-slate-700" strokeWidth={2.2} />
                <h4 className="text-sm font-bold text-slate-700">Маршрут участка</h4>
                <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                  · авто из грузов
                </span>
              </div>

              {/* ТОЧКИ ЗАБОРА */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-green-700 font-semibold mb-1.5">
                  📍 Забирает из {uniqueFroms.length > 1 ? `(${uniqueFroms.length} точек)` : ''}
                </div>
                {uniqueFroms.length === 0 ? (
                  <div className="text-xs text-slate-400 pl-1">
                    У выбранных грузов не заполнены адреса загрузки
                  </div>
                ) : (
                  <div className="space-y-1">
                    {uniqueFroms.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-white rounded-lg border border-green-100 p-2">
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-slate-700 break-words">
                          {fmtPlace(c.from_company, c.from_city, c.from_country)}
                          {c.from_address ? ` · ${c.from_address}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ТОЧКИ ДОСТАВКИ */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-red-700 font-semibold mb-1.5">
                  🏁 Везёт в {uniqueTos.length > 1 ? `(${uniqueTos.length} точек)` : ''}
                </div>
                {uniqueTos.length === 0 ? (
                  <div className="text-xs text-slate-400 pl-1">
                    У выбранных грузов не заполнены адреса выгрузки
                  </div>
                ) : (
                  <div className="space-y-1">
                    {uniqueTos.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-white rounded-lg border border-red-100 p-2">
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-slate-700 break-words">
                          {fmtPlace(c.to_company, c.to_city, c.to_country)}
                          {c.to_address ? ` · ${c.to_address}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ПОДСКАЗКИ */}
              {(multiFrom || multiTo) && (
                <div className="flex items-start gap-2 text-xs text-brand-800 bg-brand-50 border border-brand-200 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-600" strokeWidth={2.2} />
                  <span>
                    {multiFrom && multiTo
                      ? `Участок заезжает в несколько точек забора и несколько точек доставки — обычная ситуация для сборного рейса.`
                      : multiFrom
                        ? `Участок заезжает в ${uniqueFroms.length} разных точки — заберёт грузы в нескольких местах.`
                        : `Участок доставляет в ${uniqueTos.length} разных точки — это нормально, если везёт разным получателям.`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ЗАМЕТКИ */}
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Догруз в Камексе · перегруз в Бресте · время прибытия ..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
