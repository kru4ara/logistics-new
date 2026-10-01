'use client';

import { useState } from 'react';
import { createForwarding } from '../actions';
import SubmitButton from '../../components/SubmitButton';

type Option = { id: string; label: string };

type ContractorEntry = {
  contractor_id: string;
  price: string;
  currency: string;
  truck_number: string;
  driver_name: string;
  payment_days: string;
  notes: string;
};

type PointEntry = {
  location_id: string;
  date: string;
  loading_number: string;
  notes: string;
};

const emptyContractor: ContractorEntry = {
  contractor_id: '',
  price: '',
  currency: 'EUR',
  truck_number: '',
  driver_name: '',
  payment_days: '30',
  notes: '',
};

const emptyPoint: PointEntry = {
  location_id: '',
  date: '',
  loading_number: '',
  notes: '',
};

const TRANSPORT_TYPES = [
  { value: 'Plandeka / Standart', label: 'Plandeka / Standart' },
  { value: 'Chlodnia', label: 'Chłodnia' },
];

function PointRow({
  type,
  point,
  idx,
  locations,
  isRemovable,
  onUpdate,
  onRemove,
}: {
  type: 'loading' | 'unloading';
  point: PointEntry;
  idx: number;
  locations: Option[];
  isRemovable: boolean;
  onUpdate: (idx: number, field: keyof PointEntry, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const icon = type === 'loading' ? '📍' : '🏁';
  const label = type === 'loading' ? 'Погрузка' : 'Выгрузка';
  const color = type === 'loading' ? 'border-green-500' : 'border-red-500';

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className={`border-l-4 ${color} rounded-xl p-3 md:p-4 bg-slate-50/40 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">
          {icon} {label} #{idx + 1}
        </div>
        {isRemovable && (
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="text-red-600 hover:text-red-700 text-xs md:text-sm font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            ✕ Удалить
          </button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={labelClass}>Локация *</label>
          <select
            name={`${type}_${idx}_location_id`}
            required
            value={point.location_id}
            onChange={(e) => onUpdate(idx, 'location_id', e.target.value)}
            className={inputClass}
          >
            <option value="">— Выберите локацию —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Дата</label>
          <input
            type="date"
            name={`${type}_${idx}_date`}
            value={point.date}
            onChange={(e) => onUpdate(idx, 'date', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Погрузочный номер</label>
          <input
            type="text"
            name={`${type}_${idx}_loading_number`}
            value={point.loading_number}
            onChange={(e) => onUpdate(idx, 'loading_number', e.target.value)}
            placeholder="Ramp 4"
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Заметки к точке</label>
          <input
            type="text"
            name={`${type}_${idx}_notes`}
            value={point.notes}
            onChange={(e) => onUpdate(idx, 'notes', e.target.value)}
            placeholder="Контакт на месте, доп. инфо"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewForwardingForm({
  clients,
  contractors,
  loadingLocations,
  unloadingLocations,
}: {
  clients: Option[];
  contractors: Option[];
  loadingLocations: Option[];
  unloadingLocations: Option[];
}) {
  const [contractorItems, setContractorItems] = useState<ContractorEntry[]>([{ ...emptyContractor }]);
  const [loadingPoints, setLoadingPoints] = useState<PointEntry[]>([{ ...emptyPoint }]);
  const [unloadingPoints, setUnloadingPoints] = useState<PointEntry[]>([{ ...emptyPoint }]);
  const [transportType, setTransportType] = useState('');

  function addContractor() {
    if (contractorItems.length >= 10) return;
    setContractorItems([...contractorItems, { ...emptyContractor }]);
  }
  function removeContractor(idx: number) {
    setContractorItems(contractorItems.filter((_, i) => i !== idx));
  }
  function updateContractor<K extends keyof ContractorEntry>(idx: number, field: K, value: string) {
    setContractorItems(contractorItems.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function addPoint(type: 'loading' | 'unloading') {
    const arr = type === 'loading' ? loadingPoints : unloadingPoints;
    const setter = type === 'loading' ? setLoadingPoints : setUnloadingPoints;
    if (arr.length >= 10) return;
    setter([...arr, { ...emptyPoint }]);
  }
  function removePoint(type: 'loading' | 'unloading', idx: number) {
    const arr = type === 'loading' ? loadingPoints : unloadingPoints;
    const setter = type === 'loading' ? setLoadingPoints : setUnloadingPoints;
    setter(arr.filter((_, i) => i !== idx));
  }
  function updatePoint(
    type: 'loading' | 'unloading',
    idx: number,
    field: keyof PointEntry,
    value: string
  ) {
    const arr = type === 'loading' ? loadingPoints : unloadingPoints;
    const setter = type === 'loading' ? setLoadingPoints : setUnloadingPoints;
    setter(arr.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  const allEur = contractorItems.every((i) => i.currency === 'EUR');
  const eurTotal = contractorItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const isChlodnia = transportType === 'Chlodnia';

  return (
    <form action={createForwarding} className="space-y-4 md:space-y-6">

      {/* КЛИЕНТ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>🤝 Клиент</h2>
        <div>
          <label className={labelClass}>Клиент (заказчик) *</label>
          <select name="client_id" required className={inputClass}>
            <option value="">Выберите клиента...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ЗАЯВКА КЛИЕНТА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📄 Заявка клиента</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Номер заявки</label>
            <input type="text" name="client_request_number" placeholder="6750" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Дата заявки</label>
            <input type="date" name="client_request_date" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ЭКОНОМИКА КЛИЕНТА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>💰 Сколько платит клиент</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Валюта</label>
            <select name="currency" className={inputClass} defaultValue="EUR">
              <option value="EUR">EUR €</option>
              <option value="PLN">PLN zł</option>
              <option value="BYN">BYN Br</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Сумма от клиента *</label>
            <input type="number" name="client_price" step="0.01" required placeholder="5000" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ПОДРЯДЧИКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          🚛 Подрядчики
          {contractorItems.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {contractorItems.length}
            </span>
          )}
        </h2>

        {contractors.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ У вас нет подрядчиков. Сначала добавьте в разделе{' '}
            <a href="/contractors/new" className="font-semibold underline">Подрядчики</a>.
          </div>
        )}

        <div className="space-y-3">
          {contractorItems.map((item, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3 md:p-4 bg-slate-50/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Подрядчик #{idx + 1}</div>
                {contractorItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContractor(idx)}
                    className="text-red-600 hover:text-red-700 text-xs md:text-sm font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    ✕ Удалить
                  </button>
                )}
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>Подрядчик *</label>
                  <select
                    name={`contractor_${idx}_id`}
                    required
                    value={item.contractor_id}
                    onChange={(e) => updateContractor(idx, 'contractor_id', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Выберите подрядчика —</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Сумма *</label>
                  <input
                    type="number" step="0.01" required placeholder="1500"
                    value={item.price}
                    onChange={(e) => updateContractor(idx, 'price', e.target.value)}
                    name={`contractor_${idx}_price`}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Валюта</label>
                  <select
                    name={`contractor_${idx}_currency`}
                    value={item.currency}
                    onChange={(e) => updateContractor(idx, 'currency', e.target.value)}
                    className={inputClass}
                  >
                    <option value="EUR">EUR €</option>
                    <option value="PLN">PLN zł</option>
                    <option value="BYN">BYN Br</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>№ машины</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_truck_number`}
                    value={item.truck_number}
                    onChange={(e) => updateContractor(idx, 'truck_number', e.target.value)}
                    placeholder="WSI42316 / WLS73FF"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Водитель</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_driver_name`}
                    value={item.driver_name}
                    onChange={(e) => updateContractor(idx, 'driver_name', e.target.value)}
                    placeholder="Daniel Wojtczuk"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Срок оплаты (дней)</label>
                  <input
                    type="number"
                    name={`contractor_${idx}_payment_days`}
                    value={item.payment_days}
                    onChange={(e) => updateContractor(idx, 'payment_days', e.target.value)}
                    placeholder="30"
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Заметки для этого подрядчика</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_notes`}
                    value={item.notes}
                    onChange={(e) => updateContractor(idx, 'notes', e.target.value)}
                    placeholder="Доп. инфо"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {contractorItems.length < 10 && (
          <button
            type="button"
            onClick={addContractor}
            className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 font-medium
                       hover:bg-blue-50 hover:border-blue-400 transition-all duration-150
                       text-sm md:text-base active:scale-[0.99]"
          >
            + Добавить подрядчика
          </button>
        )}

        {allEur && eurTotal > 0 && (
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Итого подрядчикам</span>
            <span className="text-lg font-bold text-red-500">{eurTotal.toFixed(2)} €</span>
          </div>
        )}
      </div>

      {/* ТОЧКИ ПОГРУЗКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          📍 Погрузка
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            {loadingPoints.length}
          </span>
        </h2>

        {loadingLocations.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ У вас нет локаций для погрузки. Добавьте в разделе{' '}
            <a href="/locations/new" className="font-semibold underline">Локации</a>.
          </div>
        )}

        <div className="space-y-3">
          {loadingPoints.map((p, idx) => (
            <PointRow
              key={`loading-${idx}`}
              type="loading"
              point={p}
              idx={idx}
              locations={loadingLocations}
              isRemovable={loadingPoints.length > 1}
              onUpdate={(i, field, value) => updatePoint('loading', i, field, value)}
              onRemove={(i) => removePoint('loading', i)}
            />
          ))}
        </div>

        {loadingPoints.length < 10 && (
          <button
            type="button"
            onClick={() => addPoint('loading')}
            className="w-full py-3 rounded-xl border-2 border-dashed border-green-300 text-green-600 font-medium
                       hover:bg-green-50 hover:border-green-400 transition-all duration-150
                       text-sm md:text-base active:scale-[0.99]"
          >
            + Добавить точку погрузки
          </button>
        )}
      </div>

      {/* ТОЧКИ ВЫГРУЗКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          🏁 Выгрузка
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {unloadingPoints.length}
          </span>
        </h2>

        {unloadingLocations.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ У вас нет локаций для выгрузки. Добавьте в разделе{' '}
            <a href="/locations/new" className="font-semibold underline">Локации</a>.
          </div>
        )}

        <div className="space-y-3">
          {unloadingPoints.map((p, idx) => (
            <PointRow
              key={`unloading-${idx}`}
              type="unloading"
              point={p}
              idx={idx}
              locations={unloadingLocations}
              isRemovable={unloadingPoints.length > 1}
              onUpdate={(i, field, value) => updatePoint('unloading', i, field, value)}
              onRemove={(i) => removePoint('unloading', i)}
            />
          ))}
        </div>

        {unloadingPoints.length < 10 && (
          <button
            type="button"
            onClick={() => addPoint('unloading')}
            className="w-full py-3 rounded-xl border-2 border-dashed border-red-300 text-red-600 font-medium
                       hover:bg-red-50 hover:border-red-400 transition-all duration-150
                       text-sm md:text-base active:scale-[0.99]"
          >
            + Добавить точку выгрузки
          </button>
        )}
      </div>

      {/* ДЕТАЛИ ПЕРЕВОЗКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📦 Детали перевозки</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Тип транспорта</label>
            <select
              name="transport_type"
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              className={inputClass}
            >
              <option value="">— Выберите тип —</option>
              {TRANSPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {isChlodnia && (
            <div>
              <label className={labelClass}>Temperatura</label>
              <input
                type="text"
                name="transport_temperature"
                placeholder="+15°C / -18°C"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Тип груза</label>
            <input type="text" name="cargo_type" placeholder="Czekolady" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Количество груза</label>
            <input type="text" name="cargo_quantity" placeholder="22 epall" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Таможня при загрузке</label>
            <input type="text" name="customs_loading" placeholder="bez" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Таможня при разгрузке</label>
            <input type="text" name="customs_unloading" placeholder="bez" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Описание груза (внутр.)</label>
            <input type="text" name="cargo_description" placeholder="Паллеты, 20т" className={inputClass} />
          </div>
        </div>
      </div>

      {/* СТАТУС И ЗАМЕТКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📋 Статус</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Статус</label>
            <select name="status" className={inputClass} defaultValue="planned">
              <option value="planned">Планируется</option>
              <option value="active">В пути</option>
              <option value="completed">Завершена</option>
              <option value="invoiced">Выставлен счёт</option>
              <option value="paid">Оплачена</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Заметки (общие)</label>
            <textarea name="notes" rows={2} className={inputClass} />
          </div>
        </div>
      </div>

      {/* КНОПКИ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href="/forwarding"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </a>
        <SubmitButton
          className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
          pendingText="⏳ Создаю заявку…"
        >
          ✅ Создать заявку
        </SubmitButton>
      </div>

    </form>
  );
}
