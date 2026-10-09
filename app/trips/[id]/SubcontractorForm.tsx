'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Truck,
  Package,
  MapPin,
  X,
  Check,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  createTripSubcontractor,
  updateTripSubcontractor,
} from '../../../lib/trip-subcontractors';

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

type Contractor = {
  id: string;
  name: string;
  full_name: string | null;
  country: string | null;
  address: string | null;
  tax_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
};

export type SenderPoint = {
  num: number;
  country: string | null;
  name: string | null;
  postal_code: string | null;
  city: string | null;
  address: string | null;
  loading_number: string | null;
};

type LoadPoint = {
  sourceNum: number | null;
  date: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  company: string | null;
  postal_code: string | null;
  number: string | null;
};

type SubcontractorData = {
  id?: string;
  contractor_id: string | null;
  original_price: number;
  currency: string;
  payment_days: number;
  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  unload_date: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
  notes: string | null;
  transport_type: string | null;
  transport_temperature: string | null;
  cargo_type: string | null;
  cargo_quantity: string | null;
  customs_loading: string | null;
  customs_unloading: string | null;
  load_date?: string | null;
  load_country?: string | null;
  load_city?: string | null;
  load_address?: string | null;
  load_company?: string | null;
  load_postal_code?: string | null;
  load_number?: string | null;
  load2_date?: string | null;
  load2_country?: string | null;
  load2_city?: string | null;
  load2_address?: string | null;
  load2_company?: string | null;
  load2_postal_code?: string | null;
  load2_number?: string | null;
  load3_date?: string | null;
  load3_country?: string | null;
  load3_city?: string | null;
  load3_address?: string | null;
  load3_company?: string | null;
  load3_postal_code?: string | null;
  load3_number?: string | null;
  load4_date?: string | null;
  load4_country?: string | null;
  load4_city?: string | null;
  load4_address?: string | null;
  load4_company?: string | null;
  load4_postal_code?: string | null;
  load4_number?: string | null;
  load5_date?: string | null;
  load5_country?: string | null;
  load5_city?: string | null;
  load5_address?: string | null;
  load5_company?: string | null;
  load5_postal_code?: string | null;
  load5_number?: string | null;
};

const emptyLoadPoint: LoadPoint = {
  sourceNum: null,
  date: null,
  country: null,
  city: null,
  address: null,
  company: null,
  postal_code: null,
  number: null,
};

const emptyData: Omit<SubcontractorData, 'load_date' | 'load_country' | 'load_city' | 'load_address' | 'load_company' | 'load_postal_code' | 'load_number' | 'load2_date' | 'load2_country' | 'load2_city' | 'load2_address' | 'load2_company' | 'load2_postal_code' | 'load2_number' | 'load3_date' | 'load3_country' | 'load3_city' | 'load3_address' | 'load3_company' | 'load3_postal_code' | 'load3_number' | 'load4_date' | 'load4_country' | 'load4_city' | 'load4_address' | 'load4_company' | 'load4_postal_code' | 'load4_number' | 'load5_date' | 'load5_country' | 'load5_city' | 'load5_address' | 'load5_company' | 'load5_postal_code' | 'load5_number'> = {
  contractor_id: null,
  original_price: 0,
  currency: 'EUR',
  payment_days: 30,
  truck_number: null,
  driver_name: null,
  driver_phone: null,
  unload_date: null,
  unload_country: null,
  unload_city: null,
  unload_address: null,
  unload_company: null,
  unload_postal_code: null,
  unload_number: null,
  notes: null,
  transport_type: null,
  transport_temperature: null,
  cargo_type: null,
  cargo_quantity: null,
  customs_loading: null,
  customs_unloading: null,
};

type DefaultLoad = {
  country: string | null;
  city: string | null;
  address: string | null;
  company: string | null;
  postal_code: string | null;
  loading_number: string | null;
};

const TRANSPORT_TYPES = [
  'Plandeka / Standart',
  'Chlodnia',
];

function extractLoadPoints(initialData?: SubcontractorData): LoadPoint[] {
  if (!initialData) return [];

  const raw: LoadPoint[] = [
    { sourceNum: null, date: initialData.load_date  || null, country: initialData.load_country  || null, city: initialData.load_city  || null, address: initialData.load_address  || null, company: initialData.load_company  || null, postal_code: initialData.load_postal_code  || null, number: initialData.load_number  || null },
    { sourceNum: null, date: initialData.load2_date || null, country: initialData.load2_country || null, city: initialData.load2_city || null, address: initialData.load2_address || null, company: initialData.load2_company || null, postal_code: initialData.load2_postal_code || null, number: initialData.load2_number || null },
    { sourceNum: null, date: initialData.load3_date || null, country: initialData.load3_country || null, city: initialData.load3_city || null, address: initialData.load3_address || null, company: initialData.load3_company || null, postal_code: initialData.load3_postal_code || null, number: initialData.load3_number || null },
    { sourceNum: null, date: initialData.load4_date || null, country: initialData.load4_country || null, city: initialData.load4_city || null, address: initialData.load4_address || null, company: initialData.load4_company || null, postal_code: initialData.load4_postal_code || null, number: initialData.load4_number || null },
    { sourceNum: null, date: initialData.load5_date || null, country: initialData.load5_country || null, city: initialData.load5_city || null, address: initialData.load5_address || null, company: initialData.load5_company || null, postal_code: initialData.load5_postal_code || null, number: initialData.load5_number || null },
  ];

  return raw.filter(
    (p) => p.date || p.city || p.country || p.address || p.company || p.postal_code || p.number
  );
}

export default function SubcontractorForm({
  tripId,
  contractors,
  loadingLocations,
  unloadingLocations,
  defaultLoad,
  senderPoints,
  initialData,
  subcontractorId,
  onClose,
  onSaved,
}: {
  tripId: string;
  contractors: Contractor[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  defaultLoad?: DefaultLoad;
  senderPoints?: SenderPoint[];
  initialData?: SubcontractorData;
  subcontractorId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(subcontractorId);
  const hasSenderPoints = Boolean(senderPoints && senderPoints.length > 0);

  function initLoadPoints(): LoadPoint[] {
    if (isEdit && initialData) {
      const restored = extractLoadPoints(initialData);
      if (restored.length > 0) {
        if (senderPoints) {
          return restored.map((p) => {
            const match = senderPoints.find(
              (sp) =>
                sp.city &&
                p.city &&
                sp.city.toLowerCase() === p.city.toLowerCase() &&
                (sp.country || '') === (p.country || '')
            );
            return { ...p, sourceNum: match ? match.num : null };
          });
        }
        return restored;
      }
    }

    if (hasSenderPoints) {
      return [];
    }

    if (defaultLoad && (defaultLoad.city || defaultLoad.company || defaultLoad.country)) {
      return [
        {
          ...emptyLoadPoint,
          country: defaultLoad.country,
          city: defaultLoad.city,
          address: defaultLoad.address,
          company: defaultLoad.company,
          postal_code: defaultLoad.postal_code,
          number: defaultLoad.loading_number,
        },
      ];
    }

    return [{ ...emptyLoadPoint }];
  }

  const [data, setData] = useState<SubcontractorData>(
    initialData
      ? { ...emptyData, ...initialData }
      : { ...emptyData }
  );
  const [loadPoints, setLoadPoints] = useState<LoadPoint[]>(initLoadPoints);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all';

  function setField<K extends keyof SubcontractorData>(field: K, value: SubcontractorData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSenderPoint(num: number, checked: boolean) {
    if (checked) {
      if (loadPoints.some((p) => p.sourceNum === num)) return;
      if (loadPoints.length >= 5) return;
      const sp = senderPoints!.find((s) => s.num === num);
      if (!sp) return;
      const newPoint: LoadPoint = {
        sourceNum: num,
        date: null,
        country: sp.country,
        city: sp.city,
        address: sp.address,
        company: sp.name,
        postal_code: sp.postal_code,
        number: sp.loading_number,
      };
      const next = [...loadPoints, newPoint].sort((a, b) => {
        if (a.sourceNum === null && b.sourceNum === null) return 0;
        if (a.sourceNum === null) return 1;
        if (b.sourceNum === null) return -1;
        return a.sourceNum - b.sourceNum;
      });
      setLoadPoints(next);
    } else {
      setLoadPoints(loadPoints.filter((p) => p.sourceNum !== num));
    }
  }

  function addManualPoint() {
    if (loadPoints.length >= 5) return;
    setLoadPoints([...loadPoints, { ...emptyLoadPoint }]);
  }

  function removePoint(idx: number) {
    if (loadPoints.length <= 1) return;
    setLoadPoints(loadPoints.filter((_, i) => i !== idx));
  }

  function updatePoint(idx: number, field: keyof LoadPoint, value: string | null) {
    setLoadPoints(
      loadPoints.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  function fillPointFromLocation(idx: number, locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setLoadPoints(
      loadPoints.map((p, i) =>
        i === idx
          ? {
              ...p,
              country: loc.country,
              company: loc.company_name,
              postal_code: loc.postal_code,
              city: loc.city,
              address: loc.address,
              number: loc.default_loading_number,
            }
          : p
      )
    );
  }

  function fillUnloadFromLocation(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setData((prev) => ({
      ...prev,
      unload_country: loc.country || null,
      unload_company: loc.company_name || null,
      unload_postal_code: loc.postal_code || null,
      unload_city: loc.city || null,
      unload_address: loc.address || null,
      unload_number: loc.default_loading_number || null,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!data.contractor_id) {
      setError('Выберите подрядчика');
      return;
    }
    if (!data.original_price || data.original_price <= 0) {
      setError('Укажите цену подрядчику');
      return;
    }
    if (loadPoints.length === 0) {
      setError('Укажите хотя бы одну точку загрузки');
      return;
    }
    if (!loadPoints[0].date) {
      setError('Укажите дату первой загрузки (A1)');
      return;
    }

    const formData = new FormData();
    formData.set('contractor_id', data.contractor_id || '');
    formData.set('price', String(data.original_price));
    formData.set('currency', data.currency);
    formData.set('payment_days', String(data.payment_days));
    formData.set('truck_number', data.truck_number || '');
    formData.set('driver_name', data.driver_name || '');
    formData.set('driver_phone', data.driver_phone || '');

    const prefixes = ['load', 'load2', 'load3', 'load4', 'load5'];
    for (let i = 0; i < 5; i++) {
      const p = loadPoints[i];
      const prefix = prefixes[i];
      if (p) {
        formData.set(`${prefix}_date`, p.date || '');
        formData.set(`${prefix}_country`, p.country || '');
        formData.set(`${prefix}_city`, p.city || '');
        formData.set(`${prefix}_address`, p.address || '');
        formData.set(`${prefix}_company`, p.company || '');
        formData.set(`${prefix}_postal_code`, p.postal_code || '');
        formData.set(`${prefix}_number`, p.number || '');
      } else {
        formData.set(`${prefix}_date`, '');
        formData.set(`${prefix}_country`, '');
        formData.set(`${prefix}_city`, '');
        formData.set(`${prefix}_address`, '');
        formData.set(`${prefix}_company`, '');
        formData.set(`${prefix}_postal_code`, '');
        formData.set(`${prefix}_number`, '');
      }
    }

    formData.set('unload_date', data.unload_date || '');
    formData.set('unload_country', data.unload_country || '');
    formData.set('unload_city', data.unload_city || '');
    formData.set('unload_address', data.unload_address || '');
    formData.set('unload_company', data.unload_company || '');
    formData.set('unload_postal_code', data.unload_postal_code || '');
    formData.set('unload_number', data.unload_number || '');

    formData.set('notes', data.notes || '');
    formData.set('transport_type', data.transport_type || '');
    formData.set('transport_temperature', data.transport_temperature || '');
    formData.set('cargo_type', data.cargo_type || '');
    formData.set('cargo_quantity', data.cargo_quantity || '');
    formData.set('customs_loading', data.customs_loading || '');
    formData.set('customs_unloading', data.customs_unloading || '');

    startTransition(async () => {
      try {
        if (isEdit && subcontractorId) {
          await updateTripSubcontractor(subcontractorId, tripId, formData);
        } else {
          await createTripSubcontractor(tripId, formData);
        }
        router.refresh();
        onSaved();
      } catch (e) {
        setError((e as Error).message || 'Ошибка сохранения');
      }
    });
  }

  const isChlodnia = data.transport_type === 'Chlodnia';
  const canAddMore = loadPoints.length < 5;

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
            {isEdit ? (
              <>
                <Package className="w-5 h-5 text-brand-600" />
                Редактировать подрядчика
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-brand-600" />
                Добавить подрядчика
              </>
            )}
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

          {/* ПОДРЯДЧИК */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              Подрядчик
            </h4>

            <div>
              <label className={labelClass}>Компания *</label>
              <select
                value={data.contractor_id || ''}
                onChange={(e) => setField('contractor_id', e.target.value || null)}
                required
                className={inputClass}
              >
                <option value="">— Выберите из справочника —</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.country ? ` · ${c.country}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Цена *</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.original_price || ''}
                  onChange={(e) => setField('original_price', parseFloat(e.target.value) || 0)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Валюта</label>
                <select
                  value={data.currency}
                  onChange={(e) => setField('currency', e.target.value)}
                  className={inputClass}
                >
                  <option value="EUR">EUR €</option>
                  <option value="PLN">PLN zł</option>
                  <option value="BYN">BYN Br</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Срок оплаты (дней)</label>
                <input
                  type="number"
                  value={data.payment_days}
                  onChange={(e) => setField('payment_days', parseInt(e.target.value) || 30)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* МАШИНА / ВОДИТЕЛЬ */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-600" />
              Машина и водитель
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={labelClass}>№ машины</label>
                <input
                  type="text"
                  value={data.truck_number || ''}
                  onChange={(e) => setField('truck_number', e.target.value || null)}
                  placeholder="WSI42316 / WLS73FF"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Водитель</label>
                <input
                  type="text"
                  value={data.driver_name || ''}
                  onChange={(e) => setField('driver_name', e.target.value || null)}
                  placeholder="Daniel Wojtczuk"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Телефон водителя</label>
                <input
                  type="text"
                  value={data.driver_phone || ''}
                  onChange={(e) => setField('driver_phone', e.target.value || null)}
                  placeholder="+48 123 456 789"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ЧЕКБОКСЫ: ТОЧКИ ЗАГРУЗКИ ИЗ РЕЙСА */}
          {hasSenderPoints && (
            <div className="bg-brand-50 rounded-xl p-4 space-y-3 border border-brand-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold text-brand-800 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Точки загрузки из рейса
                </h4>
                <span className="text-[10px] text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
                  отметьте, откуда подрядчик забирает
                </span>
              </div>

              <p className="text-xs text-brand-700">
                {loadPoints.length === 0
                  ? 'Ничего не отмечено — выберите одну или несколько точек ниже, или добавьте вручную.'
                  : 'Отмеченные точки появятся в блоке «Погрузка» ниже.'}
              </p>

              <div className="space-y-2">
                {senderPoints!.map((sp) => {
                  const isChecked = loadPoints.some((p) => p.sourceNum === sp.num);
                  const place = [sp.city, sp.country].filter(Boolean).join(', ');
                  const disabled = !isChecked && loadPoints.length >= 5;
                  return (
                    <label
                      key={sp.num}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-white border-brand-400 shadow-sm'
                          : disabled
                            ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                            : 'bg-white/60 border-brand-100 hover:bg-white hover:border-brand-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={(e) => toggleSenderPoint(sp.num, e.target.checked)}
                        className="mt-1 w-4 h-4 accent-brand-600 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 break-words">
                          #{sp.num} · {sp.name || place || 'Точка'}
                        </div>
                        {place && (
                          <div className="text-xs text-slate-500 mt-0.5 break-words">{place}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ЗАГРУЗКА: A1..A5 */}
          <div className="bg-green-50 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-green-800 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Погрузка (A)
                {loadPoints.length > 1 && <span className="font-normal">· {loadPoints.length} точки</span>}
              </h4>
              <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                {hasSenderPoints ? 'A1 → A2 → ... → C' : 'откуда подрядчик забирает'}
              </span>
            </div>

            {loadPoints.length === 0 ? (
              <div className="text-sm text-green-800 text-center py-4">
                Точки не выбраны. Отметьте чекбоксы выше или добавьте вручную.
              </div>
            ) : (
              <div className="space-y-4">
                {loadPoints.map((p, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-green-200 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            A{idx + 1}
                          </span>
                          {p.sourceNum !== null && (
                            <span className="text-xs text-green-600">
                              из рейса #{p.sourceNum}
                            </span>
                          )}
                          {p.sourceNum === null && (
                            <span className="text-xs text-slate-400">вручную</span>
                          )}
                        </div>
                        {loadPoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePoint(idx)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Удалить
                          </button>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>Подставить из справочника</label>
                        <select
                          onChange={(e) => {
                            fillPointFromLocation(idx, e.target.value);
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
                          <label className={labelClass}>Дата {isFirst && '*'}</label>
                          <input
                            type="date"
                            value={p.date || ''}
                            onChange={(e) => updatePoint(idx, 'date', e.target.value || null)}
                            required={isFirst}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>№ погрузки</label>
                          <input
                            type="text"
                            value={p.number || ''}
                            onChange={(e) => updatePoint(idx, 'number', e.target.value || null)}
                            placeholder="Ramp 4"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Страна</label>
                          <input
                            type="text"
                            value={p.country || ''}
                            onChange={(e) => updatePoint(idx, 'country', e.target.value || null)}
                            placeholder="Poland"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Почтовый код</label>
                          <input
                            type="text"
                            value={p.postal_code || ''}
                            onChange={(e) => updatePoint(idx, 'postal_code', e.target.value || null)}
                            placeholder="00-001"
                            className={inputClass}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Компания</label>
                          <input
                            type="text"
                            value={p.company || ''}
                            onChange={(e) => updatePoint(idx, 'company', e.target.value || null)}
                            placeholder="KAMEX Sp. z o.o."
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Город</label>
                          <input
                            type="text"
                            value={p.city || ''}
                            onChange={(e) => updatePoint(idx, 'city', e.target.value || null)}
                            placeholder="Siedlce"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Адрес</label>
                          <input
                            type="text"
                            value={p.address || ''}
                            onChange={(e) => updatePoint(idx, 'address', e.target.value || null)}
                            placeholder="ul. Przykładowa 1"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canAddMore && (
              <button
                type="button"
                onClick={addManualPoint}
                className="w-full py-2.5 rounded-lg border-2 border-dashed border-green-300 text-green-700 font-medium text-sm
                           hover:bg-green-100 hover:border-green-400 transition-all active:scale-[0.99]
                           inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Добавить точку вручную
              </button>
            )}
          </div>

          {/* ВЫГРУЗКА (C) */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Выгрузка (точка C)
              </h4>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                куда довозит подрядчик
              </span>
            </div>

            <div>
              <label className={labelClass}>
                Выбрать из сохранённых локаций
                <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">
                  (перезапишет поля ниже)
                </span>
              </label>
              <select
                onChange={(e) => fillUnloadFromLocation(e.target.value)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-200">
              <div>
                <label className={labelClass}>Дата</label>
                <input
                  type="date"
                  value={data.unload_date || ''}
                  onChange={(e) => setField('unload_date', e.target.value || null)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>№ выгрузки</label>
                <input
                  type="text"
                  value={data.unload_number || ''}
                  onChange={(e) => setField('unload_number', e.target.value || null)}
                  placeholder="Ramp 1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={data.unload_country || ''}
                  onChange={(e) => setField('unload_country', e.target.value || null)}
                  placeholder="Belarus"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={data.unload_postal_code || ''}
                  onChange={(e) => setField('unload_postal_code', e.target.value || null)}
                  placeholder="225038"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Компания</label>
                <input
                  type="text"
                  value={data.unload_company || ''}
                  onChange={(e) => setField('unload_company', e.target.value || null)}
                  placeholder="ООО Пример"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={data.unload_city || ''}
                  onChange={(e) => setField('unload_city', e.target.value || null)}
                  placeholder="Brest"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={data.unload_address || ''}
                  onChange={(e) => setField('unload_address', e.target.value || null)}
                  placeholder="ул. Советская 1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ДЕТАЛИ ПЕРЕВОЗКИ */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Детали перевозки
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Тип транспорта</label>
                <select
                  value={data.transport_type || ''}
                  onChange={(e) => setField('transport_type', e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">— Выберите тип —</option>
                  {TRANSPORT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {isChlodnia && (
                <div>
                  <label className={labelClass}>Temperatura</label>
                  <input
                    type="text"
                    value={data.transport_temperature || ''}
                    onChange={(e) => setField('transport_temperature', e.target.value || null)}
                    placeholder="+15°C / -18°C"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Тип груза</label>
                <input
                  type="text"
                  value={data.cargo_type || ''}
                  onChange={(e) => setField('cargo_type', e.target.value || null)}
                  placeholder="Czekolady"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Количество груза</label>
                <input
                  type="text"
                  value={data.cargo_quantity || ''}
                  onChange={(e) => setField('cargo_quantity', e.target.value || null)}
                  placeholder="22 epall"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Таможня при загрузке</label>
                <input
                  type="text"
                  value={data.customs_loading || ''}
                  onChange={(e) => setField('customs_loading', e.target.value || null)}
                  placeholder="bez"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Таможня при разгрузке</label>
                <input
                  type="text"
                  value={data.customs_unloading || ''}
                  onChange={(e) => setField('customs_unloading', e.target.value || null)}
                  placeholder="bez"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ЗАМЕТКИ */}
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={data.notes || ''}
              onChange={(e) => setField('notes', e.target.value || null)}
              rows={2}
              className={inputClass}
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
