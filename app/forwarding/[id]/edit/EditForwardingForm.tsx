'use client';

import { useState } from 'react';
import { updateForwarding } from '../../actions';
import SubmitButton from '../../../components/SubmitButton';
import {
  Users,
  FileText,
  Wallet,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  ClipboardList,
  Trash2,
  Plus,
} from 'lucide-react';

type Option = { id: string; label: string };

type Order = {
  id: string;
  client_id: string | null;
  original_currency: string | null;
  original_client_price: number | null;
  cargo_description: string | null;
  notes: string | null;
  status: string | null;
  client_request_number: string | null;
  client_request_date: string | null;
  transport_type: string | null;
  transport_temperature: string | null;
  cargo_type: string | null;
  cargo_quantity: string | null;
  customs_loading: string | null;
  customs_unloading: string | null;
};

type InitialContractor = {
  contractor_id: string | null;
  original_price: number | null;
  currency: string | null;
  truck_number: string | null;
  driver_name: string | null;
  payment_days: number | null;
  notes: string | null;
};

type InitialPoint = {
  id: string;
  type: 'loading' | 'unloading';
  sequence: number;
  location_id: string | null;
  date: string | null;
  loading_number: string | null;
  notes: string | null;
};

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

// ============================================================
// ВАЖНО: PointRow объявлен СНАРУЖИ основного компонента.
// Иначе при вводе в поля React пересоздаёт компонент → input теряет фокус.
// ============================================================
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
  const Icon = type === 'loading' ? ArrowDownToLine : ArrowUpFromLine;
  const label = type === 'loading' ? 'Погрузка' : 'Выгрузка';
  const color = type === 'loading' ? 'border-green-500' : 'border-red-500';
  const iconColor = type === 'loading' ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`border-l-4 ${color} rounded-xl p-3 md:p-4 bg-slate-50/40 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.2} />
          <span>{label} #{idx + 1}</span>
        </div>
        {isRemovable && (
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs md:text-sm font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
            Удалить
          </button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Локация *</label>
          <select
            name={`${type}_${idx}_location_id`}
            required
            value={point.location_id}
            onChange={(e) => onUpdate(idx, 'location_id', e.target.value)}
            className="input"
          >
            <option value="">— Выберите локацию —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Дата</label>
          <input
            type="date"
            name={`${type}_${idx}_date`}
            value={point.date}
            onChange={(e) => onUpdate(idx, 'date', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Погрузочный номер</label>
          <input
            type="text"
            name={`${type}_${idx}_loading_number`}
            value={point.loading_number}
            onChange={(e) => onUpdate(idx, 'loading_number', e.target.value)}
            placeholder="Ramp 4"
            className="input"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Заметки к точке</label>
          <input
            type="text"
            name={`${type}_${idx}_notes`}
            value={point.notes}
            onChange={(e) => onUpdate(idx, 'notes', e.target.value)}
            placeholder="Контакт на месте, доп. инфо"
            className="input"
          />
        </div>
      </div>
    </div>
  );
}

export default function EditForwardingForm({
  order,
  orderId,
  clients,
  contractors,
  loadingLocations,
  unloadingLocations,
  initialContractors,
  initialPoints,
}: {
  order: Order;
  orderId: string;
  clients: Option[];
  contractors: Option[];
  loadingLocations: Option[];
  unloadingLocations: Option[];
  initialContractors: InitialContractor[];
  initialPoints: InitialPoint[];
}) {
  const startContractors: ContractorEntry[] =
    initialContractors.length > 0
      ? initialContractors.map((c) => ({
          contractor_id: c.contractor_id || '',
          price: c.original_price != null ? String(c.original_price) : '',
          currency: c.currency || 'EUR',
          truck_number: c.truck_number || '',
          driver_name: c.driver_name || '',
          payment_days: c.payment_days != null ? String(c.payment_days) : '30',
          notes: c.notes || '',
        }))
      : [{ ...emptyContractor }];

  const startLoading = initialPoints.filter((p) => p.type === 'loading');
  const startUnloading = initialPoints.filter((p) => p.type === 'unloading');

  const [contractorItems, setContractorItems] = useState<ContractorEntry[]>(startContractors);
  const [loadingPoints, setLoadingPoints] = useState<PointEntry[]>(
    startLoading.length > 0
      ? startLoading.map((p) => ({
          location_id: p.location_id || '',
          date: p.date || '',
          loading_number: p.loading_number || '',
          notes: p.notes || '',
        }))
      : [{ ...emptyPoint }]
  );
  const [unloadingPoints, setUnloadingPoints] = useState<PointEntry[]>(
    startUnloading.length > 0
      ? startUnloading.map((p) => ({
          location_id: p.location_id || '',
          date: p.date || '',
          loading_number: p.loading_number || '',
          notes: p.notes || '',
        }))
      : [{ ...emptyPoint }]
  );
  const [transportType, setTransportType] = useState(order.transport_type || '');

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

  const allEur = contractorItems.every((i) => i.currency === 'EUR');
  const eurTotal = contractorItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const isChlodnia = transportType === 'Chlodnia';

  return (
    <form action={updateForwarding.bind(null, orderId)} className="space-y-4 md:space-y-6">

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Клиент
        </h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Клиент (заказчик)</label>
          <select name="client_id" defaultValue={order.client_id || ''} className="input">
            <option value="">Выберите клиента…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Заявка клиента
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Номер заявки</label>
            <input
              type="text" name="client_request_number"
              defaultValue={order.client_request_number || ''}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дата заявки</label>
            <input
              type="date" name="client_request_date"
              defaultValue={order.client_request_date || ''}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Сколько платит клиент
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Валюта</label>
            <select name="currency" className="input" defaultValue={order.original_currency || 'EUR'}>
              <option value="EUR">EUR €</option>
              <option value="PLN">PLN zł</option>
              <option value="BYN">BYN Br</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Сумма от клиента *</label>
            <input
              type="number" name="client_price" step="0.01" required
              defaultValue={order.original_client_price || 0}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Подрядчики
          {contractorItems.length > 0 && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
              {contractorItems.length}
            </span>
          )}
        </h2>

        <div className="space-y-3">
          {contractorItems.map((item, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3 md:p-4 bg-slate-50/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Подрядчик #{idx + 1}</div>
                {contractorItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContractor(idx)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs md:text-sm font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                    Удалить
                  </button>
                )}
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Подрядчик *</label>
                  <select
                    name={`contractor_${idx}_id`} required
                    value={item.contractor_id}
                    onChange={(e) => updateContractor(idx, 'contractor_id', e.target.value)}
                    className="input"
                  >
                    <option value="">— Выберите подрядчика —</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Сумма *</label>
                  <input
                    type="number" step="0.01" required
                    value={item.price}
                    onChange={(e) => updateContractor(idx, 'price', e.target.value)}
                    name={`contractor_${idx}_price`}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Валюта</label>
                  <select
                    name={`contractor_${idx}_currency`}
                    value={item.currency}
                    onChange={(e) => updateContractor(idx, 'currency', e.target.value)}
                    className="input"
                  >
                    <option value="EUR">EUR €</option>
                    <option value="PLN">PLN zł</option>
                    <option value="BYN">BYN Br</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">№ машины</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_truck_number`}
                    value={item.truck_number}
                    onChange={(e) => updateContractor(idx, 'truck_number', e.target.value)}
                    placeholder="WSI42316 / WLS73FF"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Водитель</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_driver_name`}
                    value={item.driver_name}
                    onChange={(e) => updateContractor(idx, 'driver_name', e.target.value)}
                    placeholder="Daniel Wojtczuk"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Срок оплаты (дней)</label>
                  <input
                    type="number"
                    name={`contractor_${idx}_payment_days`}
                    value={item.payment_days}
                    onChange={(e) => updateContractor(idx, 'payment_days', e.target.value)}
                    placeholder="30"
                    className="input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Заметки для этого подрядчика</label>
                  <input
                    type="text"
                    name={`contractor_${idx}_notes`}
                    value={item.notes}
                    onChange={(e) => updateContractor(idx, 'notes', e.target.value)}
                    className="input"
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
            className="w-full py-3 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 font-medium
                       hover:bg-brand-50 hover:border-brand-400 transition-all duration-150
                       text-sm md:text-base active:scale-[0.99] inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Добавить подрядчика
          </button>
        )}

        {allEur && eurTotal > 0 && (
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Итого подрядчикам</span>
            <span className="text-lg font-bold text-red-500 tabular-nums">{eurTotal.toFixed(2)} €</span>
          </div>
        )}
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-green-600" strokeWidth={2} />
          Погрузка
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            {loadingPoints.length}
          </span>
        </h2>

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
                       text-sm md:text-base active:scale-[0.99] inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Добавить точку погрузки
          </button>
        )}
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <ArrowUpFromLine className="w-5 h-5 text-red-600" strokeWidth={2} />
          Выгрузка
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {unloadingPoints.length}
          </span>
        </h2>

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
                       text-sm md:text-base active:scale-[0.99] inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Добавить точку выгрузки
          </button>
        )}
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Детали перевозки
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тип транспорта</label>
            <select
              name="transport_type"
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              className="input"
            >
              <option value="">— Выберите тип —</option>
              {TRANSPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {isChlodnia && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Temperatura</label>
              <input
                type="text"
                name="transport_temperature"
                defaultValue={order.transport_temperature || ''}
                placeholder="+15°C / -18°C"
                className="input"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тип груза</label>
            <input type="text" name="cargo_type" defaultValue={order.cargo_type || ''} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Количество груза</label>
            <input type="text" name="cargo_quantity" defaultValue={order.cargo_quantity || ''} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Таможня при загрузке</label>
            <input type="text" name="customs_loading" defaultValue={order.customs_loading || ''} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Таможня при разгрузке</label>
            <input type="text" name="customs_unloading" defaultValue={order.customs_unloading || ''} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание груза (внутр.)</label>
            <input type="text" name="cargo_description" defaultValue={order.cargo_description || ''} className="input" />
          </div>
        </div>
      </div>

      <div className="card p-5 md:p-6 space-y-4">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Статус
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
            <select name="status" className="input" defaultValue={order.status || 'planned'}>
              <option value="planned">Планируется</option>
              <option value="active">В пути</option>
              <option value="completed">Завершена</option>
              <option value="invoiced">Выставлен счёт</option>
              <option value="paid">Оплачена</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Заметки (общие)</label>
            <textarea name="notes" rows={3} defaultValue={order.notes || ''} className="input" />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href={`/forwarding/${orderId}`}
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </a>
        <SubmitButton
          className="btn btn-primary w-full sm:flex-1 py-3"
          pendingText="Сохраняю…"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Сохранить изменения
        </SubmitButton>
      </div>

    </form>
  );
}
