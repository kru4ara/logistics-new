'use client';

import { useState } from 'react';
import {
  Truck,
  FileText,
  MapPin,
  Flag,
} from 'lucide-react';
import { updateTrip } from '../../../trip-actions';
import SubmitButton from '../../../components/SubmitButton';
import OverlapWarning from '../../OverlapWarning';

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

type AddrState = {
  country: string;
  name: string;
  postal_code: string;
  city: string;
  address: string;
  loading_number: string;
};

// ⬅️ ИЗМЕНЕНО: sender_*/receiver_* → from_*/to_*
type Trip = {
  client_id: string | null;
  truck_id: string | null;
  trailer_id: string | null;
  driver_id: string | null;
  start_date: string | null;
  end_date: string | null;
  revenue_eur: number | null;
  start_fuel_level: number | null;
  client_request_number: string | null;
  client_request_date: string | null;
  from_country: string | null;
  from_name: string | null;
  from_postal_code: string | null;
  from_city: string | null;
  from_address: string | null;
  from_loading_number: string | null;
  to_country: string | null;
  to_name: string | null;
  to_postal_code: string | null;
  to_city: string | null;
  to_address: string | null;
  to_loading_number: string | null;
};

type Props = {
  trip: Trip;
  tripId: string;
  clients: Option[];
  tractors: Option[];
  trailers: Option[];
  drivers: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
};

function toAddr(
  country: string | null,
  name: string | null,
  postal_code: string | null,
  city: string | null,
  address: string | null,
  loading_number: string | null
): AddrState {
  return {
    country: country || '',
    name: name || '',
    postal_code: postal_code || '',
    city: city || '',
    address: address || '',
    loading_number: loading_number || '',
  };
}

function toIsoDate(d: string | null): string {
  if (!d) return '';
  return d.split('T')[0];
}

export default function EditTripForm({
  trip,
  tripId,
  clients,
  tractors,
  trailers,
  drivers,
  loadingLocations,
  unloadingLocations,
}: Props) {
  // ⬅️ ИЗМЕНЕНО: sender→from, receiver→to + trip.from_*/trip.to_*
  const [from, setFrom] = useState<AddrState>(
    toAddr(trip.from_country, trip.from_name, trip.from_postal_code, trip.from_city, trip.from_address, trip.from_loading_number)
  );
  const [to, setTo] = useState<AddrState>(
    toAddr(trip.to_country, trip.to_name, trip.to_postal_code, trip.to_city, trip.to_address, trip.to_loading_number)
  );

  // Controlled — для OverlapWarning
  const [truckId, setTruckId] = useState(trip.truck_id || '');
  const [startDate, setStartDate] = useState(toIsoDate(trip.start_date));
  const [endDate, setEndDate] = useState(toIsoDate(trip.end_date));

  // ⬅️ ИЗМЕНЕНО: fillSender → fillFrom
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

  // ⬅️ ИЗМЕНЕНО: fillReceiver → fillTo
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

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'card p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all duration-150';

  return (
    <form action={updateTrip.bind(null, tripId)} className="space-y-4 md:space-y-6">

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Truck className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Основные данные
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label className={labelClass}>Клиент</label>
            <select name="client_id" defaultValue={trip.client_id || ''} className={inputClass}>
              <option value="">Выберите клиента...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Тягач</label>
            <select
              name="truck_id"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className={inputClass}
            >
              <option value="">Выберите тягач...</option>
              {tractors.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <OverlapWarning
              truckId={truckId}
              startDate={startDate}
              endDate={endDate}
              excludeTripId={tripId}
            />
          </div>
          <div>
            <label className={labelClass}>Прицеп</label>
            <select name="trailer_id" defaultValue={trip.trailer_id || ''} className={inputClass}>
              <option value="">Без прицепа</option>
              {trailers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Водитель</label>
            <select name="driver_id" defaultValue={trip.driver_id || ''} className={inputClass}>
              <option value="">Выберите водителя...</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Дата старта</label>
            <input
              type="date"
              name="start_date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Дата финиша</label>
            <input
              type="date"
              name="end_date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1">Оставьте пустым, если рейс ещё не завершён</p>
          </div>
          <div>
            <label className={labelClass}>Фрахт (€)</label>
            <input type="number" name="revenue_eur" step="0.01" defaultValue={trip.revenue_eur || 0} className={inputClass} />
          </div>
          <div className="md:col-span-3 lg:col-span-1">
            <label className={labelClass}>Остаток топлива (л)</label>
            <input type="number" name="start_fuel_level" step="0.01" defaultValue={trip.start_fuel_level || 0} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Заявка клиента
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Номер заявки</label>
            <input type="text" name="client_request_number" defaultValue={trip.client_request_number || ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Дата заявки</label>
            <input type="date" name="client_request_date" defaultValue={trip.client_request_date || ''} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Отправитель (основная загрузка)
        </h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          {/* ⬅️ ИЗМЕНЕНО: fillSender → fillFrom */}
          <select onChange={(e) => fillFrom(e.target.value)} className={presetClass} defaultValue="">
            <option value="">— Выберите локацию —</option>
            {loadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* ⬅️ ИЗМЕНЕНО: sender_* → from_*, sender→from */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label className={labelClass}>Страна</label>
            <input type="text" name="from_country" value={from.country}
              onChange={(e) => setFrom({ ...from, country: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название отправителя</label>
            <input type="text" name="from_name" value={from.name}
              onChange={(e) => setFrom({ ...from, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="from_postal_code" value={from.postal_code}
              onChange={(e) => setFrom({ ...from, postal_code: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="from_city" value={from.city}
              onChange={(e) => setFrom({ ...from, city: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="from_address" value={from.address}
              onChange={(e) => setFrom({ ...from, address: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="from_loading_number" value={from.loading_number}
              onChange={(e) => setFrom({ ...from, loading_number: e.target.value })} className={inputClass} />
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg px-3 py-2">
          💡 Дополнительные точки погрузки и участки рейса — на карточке рейса в блоке «Участки».
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Flag className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Получатель (выгрузка)
        </h2>

        <div>
          <label className={labelClass}>
            Выбрать из сохранённых локаций
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">(заполнит поля ниже)</span>
          </label>
          {/* ⬅️ ИЗМЕНЕНО: fillReceiver → fillTo */}
          <select onChange={(e) => fillTo(e.target.value)} className={presetClass} defaultValue="">
            <option value="">— Выберите локацию —</option>
            {unloadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* ⬅️ ИЗМЕНЕНО: receiver_* → to_*, receiver→to */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label className={labelClass}>Страна</label>
            <input type="text" name="to_country" value={to.country}
              onChange={(e) => setTo({ ...to, country: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Название получателя</label>
            <input type="text" name="to_name" value={to.name}
              onChange={(e) => setTo({ ...to, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Почтовый код</label>
            <input type="text" name="to_postal_code" value={to.postal_code}
              onChange={(e) => setTo({ ...to, postal_code: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Город</label>
            <input type="text" name="to_city" value={to.city}
              onChange={(e) => setTo({ ...to, city: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Адрес</label>
            <input type="text" name="to_address" value={to.address}
              onChange={(e) => setTo({ ...to, address: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Погрузочный номер</label>
            <input type="text" name="to_loading_number" value={to.loading_number}
              onChange={(e) => setTo({ ...to, loading_number: e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href={`/trips/${tripId}`}
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </a>
        <SubmitButton
          className="w-full sm:flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
          pendingText="Сохраняю изменения…"
        >
          Сохранить изменения
        </SubmitButton>
      </div>

    </form>
  );
}
