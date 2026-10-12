'use client';

import { useState, useTransition } from 'react';
import {
  Truck,
  Users,
  MapPin,
  Flag,
  X,
  Check,
  Loader2,
  Package,
  Wand2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { createSegment, updateSegment } from './segment-actions';

type Location = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  company_name: string | null;
  postal_code: string | null;
  city: string | null;
  address: string | null;
  default_loading_number: string | null;
};

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

type Addr = {
  country: string;
  city: string;
  company: string;
  address: string;
  postal_code: string;
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

function toAddr(
  country: string | null,
  city: string | null,
  company: string | null,
  address: string | null,
  postal_code: string | null
): Addr {
  return {
    country: country || '',
    city: city || '',
    company: company || '',
    address: address || '',
    postal_code: postal_code || '',
  };
}

function addrIsEmpty(a: Addr): boolean {
  return !a.country && !a.city && !a.company && !a.address && !a.postal_code;
}

function fmtCargoPlace(company: string | null, city: string | null, country: string | null): string {
  const parts = [company, city, country].filter(Boolean);
  return parts.join(', ') || '—';
}

export default function SegmentForm({
  tripId,
  segmentId,
  initialData,
  initialCargoIds,
  contractors,
  trucks,
  drivers,
  loadingLocations,
  unloadingLocations,
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
  loadingLocations: Location[];
  unloadingLocations: Location[];
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

  const [from, setFrom] = useState<Addr>(
    toAddr(
      initialData?.from_country ?? null,
      initialData?.from_city ?? null,
      initialData?.from_company ?? null,
      initialData?.from_address ?? null,
      initialData?.from_postal_code ?? null
    )
  );
  const [to, setTo] = useState<Addr>(
    toAddr(
      initialData?.to_country ?? null,
      initialData?.to_city ?? null,
      initialData?.to_company ?? null,
      initialData?.to_address ?? null,
      initialData?.to_postal_code ?? null
    )
  );

  const [selectedCargo, setSelectedCargo] = useState<Set<string>>(
    new Set(initialCargoIds || [])
  );

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all';

  function applyCargoRoute(cargo: CargoOption) {
    setFrom({
      country: cargo.from_country || '',
      city: cargo.from_city || '',
      company: cargo.from_company || '',
      address: cargo.from_address || '',
      postal_code: cargo.from_postal_code || '',
    });
    setTo({
      country: cargo.to_country || '',
      city: cargo.to_city || '',
      company: cargo.to_company || '',
      address: cargo.to_address || '',
      postal_code: cargo.to_postal_code || '',
    });
  }

  function fillFromLocation(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setFrom({
      country: loc.country || '',
      city: loc.city || '',
      company: loc.company_name || '',
      address: loc.address || '',
      postal_code: loc.postal_code || '',
    });
  }

  function fillToLocation(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setTo({
      country: loc.country || '',
      city: loc.city || '',
      company: loc.company_name || '',
      address: loc.address || '',
      postal_code: loc.postal_code || '',
    });
  }

  function toggleCargo(id: string) {
    setSelectedCargo((prev) => {
      const next = new Set(prev);
      const isCurrentlyChecked = next.has(id);

      if (isCurrentlyChecked) {
        next.delete(id);
      } else {
        next.add(id);

        // Автозаполнение маршрута: если поля пусты — берём из этого груза
        if (addrIsEmpty(from) && addrIsEmpty(to)) {
          const cargo = cargoList.find((c) => c.id === id);
          if (cargo) applyCargoRoute(cargo);
        }
      }

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

    if (!from.city && !from.country && !to.city && !to.country) {
      setError('Заполните хотя бы откуда или куда');
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
    formData.set('from_country', from.country);
    formData.set('from_city', from.city);
    formData.set('from_company', from.company);
    formData.set('from_address', from.address);
    formData.set('from_postal_code', from.postal_code);
    formData.set('to_country', to.country);
    formData.set('to_city', to.city);
    formData.set('to_company', to.company);
    formData.set('to_address', to.address);
    formData.set('to_postal_code', to.postal_code);

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

  const hasCargoRoutes = cargoList.some(
    (c) => c.from_city || c.from_country || c.to_city || c.to_country
  );

  // Выбранные грузы (в порядке списка)
  const selectedCargos = cargoList.filter((c) => selectedCargo.has(c.id));

  // Проверка: совпадают ли маршруты выбранных грузов
  const cargoRoutesDiffer = (() => {
    if (selectedCargos.length < 2) return false;
    const first = selectedCargos[0];
    return selectedCargos.some(
      (c) =>
        (c.from_city || '') !== (first.from_city || '') ||
        (c.from_country || '') !== (first.from_country || '') ||
        (c.to_city || '') !== (first.to_city || '') ||
        (c.to_country || '') !== (first.to_country || '')
    );
  })();

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
                <h4 className="text-sm font-bold text-brand-800">Какие грузы везёт</h4>
              </div>

              <div className="space-y-1.5">
                {cargoList.map((c) => {
                  const isChecked = selectedCargo.has(c.id);
                  const hasRoute = c.from_city || c.from_country || c.to_city || c.to_country;
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
                      {hasRoute && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline tabular-nums">
                          {c.from_city || c.from_country || '?'} → {c.to_city || c.to_country || '?'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* МАРШРУТЫ ВЫБРАННЫХ ГРУЗОВ */}
              {selectedCargos.length > 0 && (
                <div className="pt-3 border-t border-brand-200 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Маршруты выбранных грузов
                  </div>

                  <div className="space-y-1.5">
                    {selectedCargos.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 text-xs bg-white rounded-lg border border-brand-100 p-2"
                      >
                        <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                          {c.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-700 truncate">{c.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 break-words">
                            <span className="text-green-700">
                              {fmtCargoPlace(c.from_company, c.from_city, c.from_country)}
                            </span>
                            <span className="mx-1.5 text-slate-400">→</span>
                            <span className="text-red-700">
                              {fmtCargoPlace(c.to_company, c.to_city, c.to_country)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cargoRoutesDiffer && (
                    <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" strokeWidth={2.2} />
                      <span>
                        У выбранных грузов <b>разные маршруты</b>. Возможно, это нужно оформить
                        отдельными участками. Или укажите общий маршрут участка ниже вручную.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* БЫСТРАЯ ПОДСТАНОВКА МАРШРУТА */}
          {hasCargoRoutes && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
              <label className="text-xs font-semibold text-brand-800 mb-2 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                Быстро подставить маршрут из груза
              </label>
              <select
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const cargo = cargoList.find((c) => c.id === id);
                  if (cargo) applyCargoRoute(cargo);
                  e.target.value = '';
                }}
                className="input bg-white"
                defaultValue=""
              >
                <option value="">— Выберите груз —</option>
                {cargoList.map((c) => {
                  const hasRoute = c.from_city || c.from_country || c.to_city || c.to_country;
                  return (
                    <option key={c.id} value={c.id} disabled={!hasRoute}>
                      #{c.position} · {c.label}
                      {!hasRoute ? ' (нет адресов)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-brand-700 mt-1.5">
                Заполнит поля «Откуда» и «Куда» маршрутом выбранного груза.
              </p>
            </div>
          )}

          {/* ОТКУДА */}
          <div className="bg-green-50 rounded-xl p-4 space-y-3 border border-green-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-green-800">Откуда</h4>
            </div>

            <div>
              <label className={labelClass}>Подставить из справочника</label>
              <select
                onChange={(e) => {
                  fillFromLocation(e.target.value);
                  e.target.value = '';
                }}
                className={presetClass}
                defaultValue=""
              >
                <option value="">— Выберите локацию —</option>
                {loadingLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.city ? `· ${loc.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-green-100">
              <div>
                <label className={labelClass}>Компания</label>
                <input
                  type="text"
                  value={from.company}
                  onChange={(e) => setFrom({ ...from, company: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={from.country}
                  onChange={(e) => setFrom({ ...from, country: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={from.city}
                  onChange={(e) => setFrom({ ...from, city: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={from.postal_code}
                  onChange={(e) => setFrom({ ...from, postal_code: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={from.address}
                  onChange={(e) => setFrom({ ...from, address: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* КУДА */}
          <div className="bg-red-50 rounded-xl p-4 space-y-3 border border-red-200">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-red-800">Куда</h4>
            </div>

            <div>
              <label className={labelClass}>Подставить из справочника</label>
              <select
                onChange={(e) => {
                  fillToLocation(e.target.value);
                  e.target.value = '';
                }}
                className={presetClass}
                defaultValue=""
              >
                <option value="">— Выберите локацию —</option>
                {unloadingLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.city ? `· ${loc.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-red-100">
              <div>
                <label className={labelClass}>Компания</label>
                <input
                  type="text"
                  value={to.company}
                  onChange={(e) => setTo({ ...to, company: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={to.country}
                  onChange={(e) => setTo({ ...to, country: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={to.city}
                  onChange={(e) => setTo({ ...to, city: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={to.postal_code}
                  onChange={(e) => setTo({ ...to, postal_code: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={to.address}
                  onChange={(e) => setTo({ ...to, address: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ЗАМЕТКИ */}
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Догруз в Камексе (грузы 1, 2, 3) · перегруз в Бресте ..."
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
