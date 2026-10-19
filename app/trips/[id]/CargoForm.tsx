'use client';

import { useState, useTransition } from 'react';
import {
  Package,
  MapPin,
  Flag,
  X,
  Check,
  Loader2,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { createCargo, updateCargo } from './cargo-actions';

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

type ClientOption = { id: string; label: string };

type CargoData = {
  id?: string;
  label: string;
  cargo_type: string;
  weight_kg: number | null;
  pallets?: number | null;
  client_id: string | null;
  notes: string;
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
  customs_place?: string | null;
  customs_country?: string | null;
  customs_city?: string | null;
  customs_postal_code?: string | null;
  customs_address?: string | null;
  freight_amount?: number | null;
  freight_currency?: string | null;
};

type Addr = {
  country: string;
  city: string;
  company: string;
  address: string;
  postal_code: string;
};

type CustomsAddr = {
  place: string;
  country: string;
  city: string;
  postal_code: string;
  address: string;
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

function toCustoms(
  place: string | null | undefined,
  country: string | null | undefined,
  city: string | null | undefined,
  postal_code: string | null | undefined,
  address: string | null | undefined
): CustomsAddr {
  return {
    place: place || '',
    country: country || '',
    city: city || '',
    postal_code: postal_code || '',
    address: address || '',
  };
}

export default function CargoForm({
  tripId,
  cargoId,
  initialData,
  clients,
  loadingLocations,
  unloadingLocations,
  customsLocations,
  defaultClientId,
  onClose,
  onSaved,
}: {
  tripId: string;
  cargoId?: string;
  initialData?: Partial<CargoData>;
  clients: ClientOption[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
  defaultClientId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(cargoId);

  const [label, setLabel] = useState(initialData?.label || '');
  const [cargoType, setCargoType] = useState(initialData?.cargo_type || '');
  const [weight, setWeight] = useState<string>(
    initialData?.weight_kg != null ? String(initialData.weight_kg) : ''
  );
  const [pallets, setPallets] = useState<string>(
    initialData?.pallets != null ? String(initialData.pallets) : ''
  );
  const [clientId, setClientId] = useState(
    initialData?.client_id || defaultClientId || ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [freightAmount, setFreightAmount] = useState<string>(
    initialData?.freight_amount != null ? String(initialData.freight_amount) : ''
  );
  const [freightCurrency, setFreightCurrency] = useState(initialData?.freight_currency || 'EUR');

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
  const [customs, setCustoms] = useState<CustomsAddr>(
    toCustoms(
      initialData?.customs_place,
      initialData?.customs_country,
      initialData?.customs_city,
      initialData?.customs_postal_code,
      initialData?.customs_address
    )
  );

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all';

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

  function fillCustomsLocation(locId: string) {
    if (!locId) return;
    const loc = customsLocations.find((l) => l.id === locId);
    if (!loc) return;
    setCustoms({
      place: loc.name || loc.company_name || '',
      country: loc.country || '',
      city: loc.city || '',
      postal_code: loc.postal_code || '',
      address: loc.address || '',
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError('Укажите название груза');
      return;
    }

    const formData = new FormData();
    formData.set('label', label.trim());
    formData.set('cargo_type', cargoType.trim());
    formData.set('weight_kg', weight);
    formData.set('pallets', pallets);
    formData.set('client_id', clientId);
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
    
    formData.set('customs_place', customs.place);
    formData.set('customs_country', customs.country);
    formData.set('customs_city', customs.city);
    formData.set('customs_postal_code', customs.postal_code);
    formData.set('customs_address', customs.address);
    
    formData.set('freight_amount', freightAmount);
    formData.set('freight_currency', freightCurrency);

    startTransition(async () => {
      try {
        if (isEdit && cargoId) {
          await updateCargo(cargoId, tripId, formData);
        } else {
          await createCargo(tripId, formData);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message || 'Ошибка сохранения');
      }
    });
  }

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
            <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            {isEdit ? 'Редактировать груз' : 'Добавить груз'}
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

          {/* ОСНОВНОЕ */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div>
              <label className={labelClass}>Название груза *</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Caffarel, Италия / Паллеты 22 шт"
                required
                autoFocus
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Тип груза</label>
                <input
                  type="text"
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  placeholder="паллеты / металл"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Вес (кг)</label>
                <input
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="22000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Паллеты (шт)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={pallets}
                  onChange={(e) => setPallets(e.target.value)}
                  placeholder="22"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Клиент</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Не указан —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ОТКУДА */}
          <div className="bg-green-50 rounded-xl p-4 space-y-3 border border-green-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-green-800">Откуда (загрузка)</h4>
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
                  placeholder="Caffarel S.p.A."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={from.country}
                  onChange={(e) => setFrom({ ...from, country: e.target.value })}
                  placeholder="Италия"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={from.city}
                  onChange={(e) => setFrom({ ...from, city: e.target.value })}
                  placeholder="Magenta"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={from.postal_code}
                  onChange={(e) => setFrom({ ...from, postal_code: e.target.value })}
                  placeholder="20013"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={from.address}
                  onChange={(e) => setFrom({ ...from, address: e.target.value })}
                  placeholder="Via Milano 10"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ТАМОЖНЯ */}
          <div className="bg-slate-100 rounded-xl p-4 space-y-3 border border-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-slate-800">Место затаможки</h4>
            </div>
            
            <div>
              <label className={labelClass}>Подставить из справочника</label>
              <select
                onChange={(e) => {
                  fillCustomsLocation(e.target.value);
                  e.target.value = '';
                }}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-solid focus:border-slate-500 transition-all"
                defaultValue=""
              >
                <option value="">— Выберите локацию —</option>
                {customsLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.city ? `· ${loc.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div className="md:col-span-2">
                <label className={labelClass}>Название поста / компании</label>
                <input
                  type="text"
                  value={customs.place}
                  onChange={(e) => setCustoms({ ...customs, place: e.target.value })}
                  placeholder="ТЛЦ Брест"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={customs.country}
                  onChange={(e) => setCustoms({ ...customs, country: e.target.value })}
                  placeholder="Беларусь"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={customs.city}
                  onChange={(e) => setCustoms({ ...customs, city: e.target.value })}
                  placeholder="Брест"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={customs.postal_code}
                  onChange={(e) => setCustoms({ ...customs, postal_code: e.target.value })}
                  placeholder="224000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={customs.address}
                  onChange={(e) => setCustoms({ ...customs, address: e.target.value })}
                  placeholder="ул. Таможенная 1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* КУДА */}
          <div className="bg-red-50 rounded-xl p-4 space-y-3 border border-red-200">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-red-800">Куда (выгрузка)</h4>
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
                  placeholder="ТЛЦ Брест"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Страна</label>
                <input
                  type="text"
                  value={to.country}
                  onChange={(e) => setTo({ ...to, country: e.target.value })}
                  placeholder="Беларусь"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input
                  type="text"
                  value={to.city}
                  onChange={(e) => setTo({ ...to, city: e.target.value })}
                  placeholder="Брест"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Почтовый код</label>
                <input
                  type="text"
                  value={to.postal_code}
                  onChange={(e) => setTo({ ...to, postal_code: e.target.value })}
                  placeholder="224000"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  value={to.address}
                  onChange={(e) => setTo({ ...to, address: e.target.value })}
                  placeholder="ул. Логистическая 1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ФРАХТ */}
          <div className="bg-emerald-50 rounded-xl p-4 space-y-3 border border-emerald-200">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-700" strokeWidth={2.2} />
              <h4 className="text-sm font-bold text-emerald-800">Фрахт</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  value={freightAmount}
                  onChange={(e) => setFreightAmount(e.target.value)}
                  placeholder="1500"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Валюта</label>
                <select
                  value={freightCurrency}
                  onChange={(e) => setFreightCurrency(e.target.value)}
                  className={inputClass}
                >
                  <option value="EUR">EUR €</option>
                  <option value="PLN">PLN zł</option>
                  <option value="BYN">BYN Br</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700">
              Сумма автоматически пересчитается в EUR и обновит общий фрахт рейса.
            </p>
          </div>

          {/* ЗАМЕТКИ */}
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Дополнительная информация"
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
