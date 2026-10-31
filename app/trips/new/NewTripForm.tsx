'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  MapPin,
  Flag,
  ShieldCheck,
  Package,
  Coins,
} from 'lucide-react';
import { createCargoWithTrip } from '../../geocode-actions';
import SubmitButton from '../../components/SubmitButton';

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

type Props = {
  clients: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
};

const emptyAddr = {
  country: '',
  name: '',
  postal_code: '',
  city: '',
  address: '',
  loading_number: '',
};

type AddrState = typeof emptyAddr;

const emptyCustoms = {
  place: '',
  country: '',
  city: '',
  postal_code: '',
  address: '',
};

type CustomsState = typeof emptyCustoms;

export default function NewTripForm({
  clients,
  loadingLocations,
  unloadingLocations,
  customsLocations,
}: Props) {
  const [from, setFrom] = useState<AddrState>({ ...emptyAddr });
  const [to, setTo] = useState<AddrState>({ ...emptyAddr });
  const [customs, setCustoms] = useState<CustomsState>({ ...emptyCustoms });
  const [mode, setMode] = useState<'trip' | 'forwarding'>('trip');
  const [fwdOrigin, setFwdOrigin] = useState(false);
  const [costsClosed, setCostsClosed] = useState(true);

  function fillFrom(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setFrom({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function fillTo(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setTo({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function fillCustoms(locId: string) {
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

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'card p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all duration-150';

  return (
    <form action={createCargoWithTrip} className="space-y-4 md:space-y-6">

      {/* РЕЖИМ РАСЧЁТА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Coins className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Режим расчёта
        </h2>
        <p className="text-xs text-slate-500 -mt-1">
          Режим задаёт математику экономики и то, в какой месяц заказ попадёт в статистику.
          Галочка «Экспедирование» ниже — только пометка происхождения, на расчёт не влияет.
        </p>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <label
            className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${
              mode === 'trip' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="profit_mode"
              value="trip"
              checked={mode === 'trip'}
              onChange={() => setMode('trip')}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">Рейс</span>
              <span className="block text-xs text-slate-500">
                Наш транспорт. Месяц заказа — по дате финиша, приоритет у финиша.
              </span>
            </span>
          </label>

          <label
            className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${
              mode === 'forwarding' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="profit_mode"
              value="forwarding"
              checked={mode === 'forwarding'}
              onChange={() => setMode('forwarding')}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">Экспедирование</span>
              <span className="block text-xs text-slate-500">
                Перевозка силами подрядчика. Месяц заказа — по дате загрузки, иначе разгрузки.
              </span>
            </span>
          </label>
        </div>

        {mode === 'forwarding' && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
            <div>
              <label className={labelClass}>Дата загрузки</label>
              <input type="date" name="load_date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Дата разгрузки</label>
              <input type="date" name="unload_date" className={inputClass} />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_forwarding"
              value="1"
              checked={fwdOrigin}
              onChange={(e) => setFwdOrigin(e.target.checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">Экспедирование (происхождение)</span>
              <span className="block text-xs text-slate-500">
                Помечает заказ как перевезённый экспедитором. На расчёт не влияет.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="costs_closed"
              value="1"
              checked={costsClosed}
              onChange={(e) => setCostsClosed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">Расходы сведены</span>
              <span className="block text-xs text-slate-500">
                Только завершённые заказы со сведёнными расходами попадают в статистику.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* КЛИЕНТ И ЗАЯВКА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Клиент и заявка
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label className={labelClass}>Клиент</label>
            <select name="client_id" className={inputClass}>
              <option value="">Выберите клиента...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Номер заявки</label>
            <input type="text" name="client_request_number" placeholder="ZAM-2026-001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Дата заявки</label>
            <input type="date" name="client_request_date" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ОТКУДА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Откуда (загрузка)
        </h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          <select onChange={(e) => fillFrom(e.target.value)} className={presetClass} defaultValue="">
            <option value="">— Выберите локацию —</option>
            {loadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label className={labelClass}>Страна</label>
            <input type="text" name="from_country" value={from.country}
              onChange={(e) => setFrom({ ...from, country: e.target.value })}
              placeholder="Италия" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название отправителя</label>
            <input type="text" name="from_name" value={from.name}
              onChange={(e) => setFrom({ ...from, name: e.target.value })}
              placeholder="Caffarel S.p.A." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="from_postal_code" value={from.postal_code}
              onChange={(e) => setFrom({ ...from, postal_code: e.target.value })}
              placeholder="20013" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="from_city" value={from.city}
              onChange={(e) => setFrom({ ...from, city: e.target.value })}
              placeholder="Magenta" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="from_address" value={from.address}
              onChange={(e) => setFrom({ ...from, address: e.target.value })}
              placeholder="Via Milano 10" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="from_loading_number" value={from.loading_number}
              onChange={(e) => setFrom({ ...from, loading_number: e.target.value })}
              placeholder="Ramp 4" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ТАМОЖНЯ (перенесена выше "Куда") */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <ShieldCheck className="w-5 h-5 text-slate-600" strokeWidth={2.2} />
          Место затаможки
        </h2>
        <p className="text-xs text-slate-500 -mt-1">
          Промежуточная точка между откуда и куда. Необязательно.
        </p>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          <select onChange={(e) => fillCustoms(e.target.value)} className={presetClass} defaultValue="">
            <option value="">— Выберите локацию —</option>
            {customsLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div className="md:col-span-2">
            <label className={labelClass}>Название поста / компании</label>
            <input type="text" name="customs_place" value={customs.place}
              onChange={(e) => setCustoms({ ...customs, place: e.target.value })}
              placeholder="ТЛЦ Брест" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Страна</label>
            <input type="text" name="customs_country" value={customs.country}
              onChange={(e) => setCustoms({ ...customs, country: e.target.value })}
              placeholder="Беларусь" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="customs_city" value={customs.city}
              onChange={(e) => setCustoms({ ...customs, city: e.target.value })}
              placeholder="Брест" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="customs_postal_code" value={customs.postal_code}
              onChange={(e) => setCustoms({ ...customs, postal_code: e.target.value })}
              placeholder="224000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="customs_address" value={customs.address}
              onChange={(e) => setCustoms({ ...customs, address: e.target.value })}
              placeholder="ул. Таможенная 1" className={inputClass} />
          </div>
        </div>
      </div>

      {/* КУДА (перенесена ниже "Таможни") */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Flag className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Куда (выгрузка)
        </h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          <select onChange={(e) => fillTo(e.target.value)} className={presetClass} defaultValue="">
            <option value="">— Выберите локацию —</option>
            {unloadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label className={labelClass}>Страна</label>
            <input type="text" name="to_country" value={to.country}
              onChange={(e) => setTo({ ...to, country: e.target.value })}
              placeholder="Беларусь" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название получателя</label>
            <input type="text" name="to_name" value={to.name}
              onChange={(e) => setTo({ ...to, name: e.target.value })}
              placeholder="ТЛЦ Брест" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="to_postal_code" value={to.postal_code}
              onChange={(e) => setTo({ ...to, postal_code: e.target.value })}
              placeholder="224000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="to_city" value={to.city}
              onChange={(e) => setTo({ ...to, city: e.target.value })}
              placeholder="Брест" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="to_address" value={to.address}
              onChange={(e) => setTo({ ...to, address: e.target.value })}
              placeholder="ул. Логистическая 1" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="to_loading_number" value={to.loading_number}
              onChange={(e) => setTo({ ...to, loading_number: e.target.value })}
              placeholder="Ramp 1" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ГРУЗ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Груз
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Название груза *</label>
            <input type="text" name="label" required
              placeholder="Caffarel, Италия / Паллеты 22 шт" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Тип груза</label>
            <input type="text" name="cargo_type" placeholder="паллеты / металл" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Вес (кг)</label>
            <input type="number" name="weight_kg" step="0.01" placeholder="22000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Паллеты (шт)</label>
            <input type="number" name="pallets" step="1" min="0" placeholder="22" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Примечания</label>
            <textarea name="notes" rows={2} className={inputClass} placeholder="Дополнительная информация" />
          </div>
        </div>
      </div>

      {/* ФРАХТ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Coins className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Фрахт
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={labelClass}>Сумма</label>
            <input type="number" name="freight_amount" step="0.01" min="0" placeholder="0.00" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Валюта</label>
            <select name="freight_currency" className={inputClass} defaultValue="EUR">
              <option value="EUR">EUR €</option>
              <option value="PLN">PLN zł</option>
              <option value="BYN">BYN Br</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Фрахт в EUR пересчитается по курсу на дату заявки и попадёт в отчёты.
        </p>
      </div>

      {/* КНОПКИ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <Link
          href="/trips"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </Link>
        <SubmitButton
          className="w-full sm:flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
          pendingText="Создаю заявку…"
        >
          Создать заявку
        </SubmitButton>
      </div>

    </form>
  );
}
