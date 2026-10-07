'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

type SubcontractorData = {
  id?: string;
  contractor_id: string | null;
  original_price: number;
  currency: string;
  payment_days: number;
  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  load_date: string | null;
  unload_date: string | null;
  load_country: string | null;
  load_city: string | null;
  load_address: string | null;
  load_company: string | null;
  load_postal_code: string | null;
  load_number: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
  notes: string | null;
};

const emptyData: SubcontractorData = {
  contractor_id: null,
  original_price: 0,
  currency: 'EUR',
  payment_days: 30,
  truck_number: null,
  driver_name: null,
  driver_phone: null,
  load_date: null,
  unload_date: null,
  load_country: null,
  load_city: null,
  load_address: null,
  load_company: null,
  load_postal_code: null,
  load_number: null,
  unload_country: null,
  unload_city: null,
  unload_address: null,
  unload_company: null,
  unload_postal_code: null,
  unload_number: null,
  notes: null,
};

type DefaultLoad = {
  country: string | null;
  city: string | null;
  address: string | null;
  company: string | null;
  postal_code: string | null;
  loading_number: string | null;
};

export default function SubcontractorForm({
  tripId,
  contractors,
  loadingLocations,
  unloadingLocations,
  defaultLoad,
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
  initialData?: SubcontractorData;
  subcontractorId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(subcontractorId);

  // При создании нового — предзаполняем точку погрузки данными рейса (точка A)
  const startingData: SubcontractorData = initialData || {
    ...emptyData,
    load_country: defaultLoad?.country || null,
    load_city: defaultLoad?.city || null,
    load_address: defaultLoad?.address || null,
    load_company: defaultLoad?.company || null,
    load_postal_code: defaultLoad?.postal_code || null,
    load_number: defaultLoad?.loading_number || null,
  };

  const [data, setData] = useState<SubcontractorData>(startingData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-solid focus:border-blue-500 transition-all';

  function setField<K extends keyof SubcontractorData>(field: K, value: SubcontractorData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function fillLoadFromLocation(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setData((prev) => ({
      ...prev,
      load_country: loc.country || null,
      load_company: loc.company_name || null,
      load_postal_code: loc.postal_code || null,
      load_city: loc.city || null,
      load_address: loc.address || null,
      load_number: loc.default_loading_number || null,
    }));
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
    if (!data.load_date) {
      setError('Укажите дату загрузки');
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
    formData.set('load_date', data.load_date || '');
    formData.set('unload_date', data.unload_date || '');
    formData.set('load_country', data.load_country || '');
    formData.set('load_city', data.load_city || '');
    formData.set('load_address', data.load_address || '');
    formData.set('load_company', data.load_company || '');
    formData.set('load_postal_code', data.load_postal_code || '');
    formData.set('load_number', data.load_number || '');
    formData.set('unload_country', data.unload_country || '');
    formData.set('unload_city', data.unload_city || '');
    formData.set('unload_address', data.unload_address || '');
    formData.set('unload_company', data.unload_company || '');
    formData.set('unload_postal_code', data.unload_postal_code || '');
    formData.set('unload_number', data.unload_number || '');
    formData.set('notes', data.notes || '');

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/50 overflow-y-auto"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 p-5 md:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">
            {isEdit ? '✏️ Редактировать подрядчика' : '➕ Добавить подрядчика'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ПОДРЯДЧИК */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700">🏢 Подрядчик</h4>

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
            <h4 className="text-sm font-bold text-slate-700">🚛 Машина и водитель</h4>

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

          {/* ПОГРУЗКА (A) */}
          <div className="bg-green-50 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-green-800">🟢 Погрузка (точка A рейса)</h4>
              <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                откуда подрядчик забирает
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
                onChange={(e) => fillLoadFromLocation(e.target.value)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-green-200">
              <div>
                <label className={labelClass}>Дата *</label>
                <input
                  type="date"
                  value={data.load_date || ''}
                  onChange={(e) => setField('load_date', e.target.value || null)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>№ погрузки</label>
                <input
                  type="text"
                  value={data.load_number || ''}
                  onChange={(e) => setField('load_number', e.target.value || null)}
                  placeholder="Ramp 4"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={data.load_country || ''}
                  onChange={(e) => setField('load_country', e.target.value || null)}
                  placeholder="Poland"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={data.load_postal_code || ''}
                  onChange={(e) => setField('load_postal_code', e.target.value || null)}
                  placeholder="00-001"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Компания</label>
                <input
                  type="text"
                  value={data.load_company || ''}
                  onChange={(e) => setField('load_company', e.target.value || null)}
                  placeholder="KAMEX Sp. z o.o."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={data.load_city || ''}
                  onChange={(e) => setField('load_city', e.target.value || null)}
                  placeholder="Siedlce"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={data.load_address || ''}
                  onChange={(e) => setField('load_address', e.target.value || null)}
                  placeholder="ul. Przykładowa 1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ВЫГРУЗКА (C) */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-amber-800">🔴 Выгрузка (точка C)</h4>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                куда довозит подрядчик, дальше мы сами
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
              ❌ {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50
                         flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>✅ Сохранить</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
