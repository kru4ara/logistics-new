'use client';

import { useState } from 'react';
import { addTripWithAddress } from '../../geocode-actions';

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
  tractors: Option[];
  trailers: Option[];
  drivers: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
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

export default function NewTripForm({
  clients,
  tractors,
  trailers,
  drivers,
  loadingLocations,
  unloadingLocations,
}: Props) {
  const [sender, setSender] = useState<AddrState>({ ...emptyAddr });
  const [receiver, setReceiver] = useState<AddrState>({ ...emptyAddr });
  const [extras, setExtras] = useState<AddrState[]>([]);

  function fillSender(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setSender({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function fillReceiver(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setReceiver({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function addExtra() {
    if (extras.length >= 2) return;
    setExtras([...extras, { ...emptyAddr }]);
  }

  function removeExtra(idx: number) {
    setExtras(extras.filter((_, i) => i !== idx));
  }

  function updateExtra(idx: number, field: keyof AddrState, value: string) {
    setExtras(extras.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function fillExtraFromLocation(idx: number, locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setExtras(
      extras.map((e, i) =>
        i === idx
          ? {
              country: loc.country || '',
              name: loc.company_name || '',
              postal_code: loc.postal_code || '',
              city: loc.city || '',
              address: loc.address || '',
              loading_number: loc.default_loading_number || '',
            }
          : e
      )
    );
  }

  // text-base (16px) — чтобы iOS Safari не зумил inputs при фокусе
  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-solid focus:border-blue-500 transition-all duration-150';

  return (
    <form action={addTripWithAddress} className="space-y-4 md:space-y-6">

      {/* ОСНОВНЫЕ ДАННЫЕ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>🚛 Основные данные</h2>
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
            <label className={labelClass}>Тягач</label>
            <select name="truck_id" className={inputClass}>
              <option value="">Выберите тягач...</option>
              {tractors.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Прицеп</label>
            <select name="trailer_id" className={inputClass}>
              <option value="">Без прицепа</option>
              {trailers.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Водитель</label>
            <select name="driver_id" className={inputClass}>
              <option value="">Выберите водителя...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Дата старта</label>
            <input type="date" name="start_date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Фрахт (€)</label>
            <input type="number" name="revenue_eur" step="0.01" placeholder="0.00" className={inputClass} />
          </div>
          <div className="md:col-span-3 lg:col-span-1">
            <label className={labelClass}>Остаток топлива (л)</label>
            <input type="number" name="start_fuel_level" step="0.01" placeholder="200" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ЗАЯВКА КЛИЕНТА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📄 Заявка клиента</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
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

      {/* ЗАГРУЗКА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📍 Отправитель (основная загрузка)</h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          <select onChange={(e) => fillSender(e.target.value)} className={presetClass} defaultValue="">
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
            <input type="text" name="sender_country" value={sender.country}
              onChange={(e) => setSender({ ...sender, country: e.target.value })}
              placeholder="Польша" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название отправителя</label>
            <input type="text" name="sender_name" value={sender.name}
              onChange={(e) => setSender({ ...sender, name: e.target.value })}
              placeholder="ООО Пример" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="sender_postal_code" value={sender.postal_code}
              onChange={(e) => setSender({ ...sender, postal_code: e.target.value })}
              placeholder="00-001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="sender_city" value={sender.city}
              onChange={(e) => setSender({ ...sender, city: e.target.value })}
              placeholder="Варшава" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="sender_address" value={sender.address}
              onChange={(e) => setSender({ ...sender, address: e.target.value })}
              placeholder="ул. Примерная, 1" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="sender_loading_number" value={sender.loading_number}
              onChange={(e) => setSender({ ...sender, loading_number: e.target.value })}
              placeholder="Ramp 4" className={inputClass} />
          </div>
        </div>

        {/* ДОП. ТОЧКИ ПОГРУЗКИ */}
        {extras.map((extra, idx) => {
          const n = idx + 2;
          return (
            <div key={idx} className="border-t-2 border-blue-200 pt-4 mt-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">
                  📍 Доп. точка погрузки №{idx + 1}
                </h3>
                <button
                  type="button"
                  onClick={() => removeExtra(idx)}
                  className="text-red-600 hover:text-red-700 text-xs md:text-sm font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                >
                  ✕ Удалить
                </button>
              </div>

              <div>
                <label className={labelClass}>Выбрать из сохранённых локаций</label>
                <select
                  onChange={(e) => fillExtraFromLocation(idx, e.target.value)}
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

              <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2">
                <div>
                  <label className={labelClass}>Страна</label>
                  <input type="text" name={`sender${n}_country`} value={extra.country}
                    onChange={(e) => updateExtra(idx, 'country', e.target.value)}
                    placeholder="Польша" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Название отправителя</label>
                  <input type="text" name={`sender${n}_name`} value={extra.name}
                    onChange={(e) => updateExtra(idx, 'name', e.target.value)}
                    placeholder="ООО Пример" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Почтовый код</label>
                  <input type="text" name={`sender${n}_postal_code`} value={extra.postal_code}
                    onChange={(e) => updateExtra(idx, 'postal_code', e.target.value)}
                    placeholder="00-001" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Город</label>
                  <input type="text" name={`sender${n}_city`} value={extra.city}
                    onChange={(e) => updateExtra(idx, 'city', e.target.value)}
                    placeholder="Варшава" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Адрес</label>
                  <input type="text" name={`sender${n}_address`} value={extra.address}
                    onChange={(e) => updateExtra(idx, 'address', e.target.value)}
                    placeholder="ул. Примерная, 1" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Погрузочный номер</label>
                  <input type="text" name={`sender${n}_loading_number`} value={extra.loading_number}
                    onChange={(e) => updateExtra(idx, 'loading_number', e.target.value)}
                    placeholder="Ramp 4" className={inputClass} />
                </div>
              </div>
            </div>
          );
        })}

        {extras.length < 2 && (
          <button
            type="button"
            onClick={addExtra}
            className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 font-medium
                       hover:bg-blue-50 hover:border-blue-400 transition-all duration-150
                       text-sm md:text-base active:scale-[0.99]"
          >
            + Добавить точку погрузки
          </button>
        )}
      </div>

      {/* ВЫГРУЗКА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>🏁 Получатель (выгрузка)</h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          <select onChange={(e) => fillReceiver(e.target.value)} className={presetClass} defaultValue="">
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
            <input type="text" name="receiver_country" value={receiver.country}
              onChange={(e) => setReceiver({ ...receiver, country: e.target.value })}
              placeholder="Беларусь" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название получателя</label>
            <input type="text" name="receiver_name" value={receiver.name}
              onChange={(e) => setReceiver({ ...receiver, name: e.target.value })}
              placeholder="ООО Пример" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="receiver_postal_code" value={receiver.postal_code}
              onChange={(e) => setReceiver({ ...receiver, postal_code: e.target.value })}
              placeholder="220000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="receiver_city" value={receiver.city}
              onChange={(e) => setReceiver({ ...receiver, city: e.target.value })}
              placeholder="Брест" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="receiver_address" value={receiver.address}
              onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
              placeholder="ул. Советская, 1" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="receiver_loading_number" value={receiver.loading_number}
              onChange={(e) => setReceiver({ ...receiver, loading_number: e.target.value })}
              placeholder="Ramp 1" className={inputClass} />
          </div>
        </div>
      </div>

      {/* КНОПКИ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href="/trips"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </a>
        <button
          type="submit"
          className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                     shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
        >
          ✅ Создать рейс
        </button>
      </div>

    </form>
  );
}
