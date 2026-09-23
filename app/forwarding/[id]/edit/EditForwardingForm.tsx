'use client';

import { useState } from 'react';
import { updateForwarding } from '../../actions';

type Option = { id: string; label: string };

type Order = {
  id: string;
  client_id: string | null;
  original_currency: string | null;
  original_client_price: number | null;
  route_from: string | null;
  route_to: string | null;
  load_date: string | null;
  unload_date: string | null;
  cargo_description: string | null;
  notes: string | null;
  status: string | null;
  client_request_number: string | null;
  client_request_date: string | null;
};

type InitialContractor = {
  contractor_id: string | null;
  original_price: number | null;
  currency: string | null;
};

type ContractorEntry = {
  contractor_id: string;
  price: string;
  currency: string;
};

export default function EditForwardingForm({
  order,
  orderId,
  clients,
  contractors,
  initialContractors,
}: {
  order: Order;
  orderId: string;
  clients: Option[];
  contractors: Option[];
  initialContractors: InitialContractor[];
}) {
  const startItems: ContractorEntry[] =
    initialContractors.length > 0
      ? initialContractors.map((c) => ({
          contractor_id: c.contractor_id || '',
          price: c.original_price != null ? String(c.original_price) : '',
          currency: c.currency || 'EUR',
        }))
      : [{ contractor_id: '', price: '', currency: 'EUR' }];

  const [items, setItems] = useState<ContractorEntry[]>(startItems);

  function addItem() {
    if (items.length >= 10) return;
    setItems([...items, { contractor_id: '', price: '', currency: 'EUR' }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ContractorEntry, value: string) {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  const allEur = items.every((i) => i.currency === 'EUR');
  const eurTotal = items.reduce(
    (s, i) => s + (parseFloat(i.price) || 0),
    0
  );

  return (
    <form action={updateForwarding.bind(null, orderId)} className="space-y-4 md:space-y-6">

      {/* КЛИЕНТ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>🤝 Клиент</h2>
        <div>
          <label className={labelClass}>Клиент (заказчик)</label>
          <select name="client_id" defaultValue={order.client_id || ''} className={inputClass}>
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
            <input
              type="text"
              name="client_request_number"
              defaultValue={order.client_request_number || ''}
              placeholder="ZAM-2026-001"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Дата заявки</label>
            <input
              type="date"
              name="client_request_date"
              defaultValue={order.client_request_date || ''}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ЭКОНОМИКА КЛИЕНТА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>💰 Сколько платит клиент</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Валюта</label>
            <select name="currency" className={inputClass} defaultValue={order.original_currency || 'EUR'}>
              <option value="EUR">EUR €</option>
              <option value="PLN">PLN zł</option>
              <option value="BYN">BYN Br</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Сумма от клиента *</label>
            <input
              type="number"
              name="client_price"
              step="0.01"
              required
              defaultValue={order.original_client_price || 0}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Изменение суммы или валюты пересчитает EUR по курсу на дату загрузки.
        </p>
      </div>

      {/* ПОДРЯДЧИКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          🚛 Подрядчики
          {items.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {items.length}
            </span>
          )}
        </h2>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-xl p-3 md:p-4 bg-slate-50/40 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">
                  Подрядчик #{idx + 1}
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
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
                    onChange={(e) => updateItem(idx, 'contractor_id', e.target.value)}
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
                    type="number"
                    step="0.01"
                    required
                    placeholder="1500"
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', e.target.value)}
                    name={`contractor_${idx}_price`}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Валюта</label>
                  <select
                    name={`contractor_${idx}_currency`}
                    value={item.currency}
                    onChange={(e) => updateItem(idx, 'currency', e.target.value)}
                    className={inputClass}
                  >
                    <option value="EUR">EUR €</option>
                    <option value="PLN">PLN zł</option>
                    <option value="BYN">BYN Br</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length < 10 && (
          <button
            type="button"
            onClick={addItem}
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
        {!allEur && items.length > 0 && (
          <div className="text-xs text-slate-500">
            ℹ️ Валюты разные — итог в EUR посчитается на сервере по курсу.
          </div>
        )}
      </div>

      {/* МАРШРУТ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📍 Маршрут</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Откуда</label>
            <input type="text" name="route_from" defaultValue={order.route_from || ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Куда</label>
            <input type="text" name="route_to" defaultValue={order.route_to || ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Дата загрузки *</label>
            <input
              type="date"
              name="load_date"
              defaultValue={order.load_date || ''}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Дата выгрузки</label>
            <input
              type="date"
              name="unload_date"
              defaultValue={order.unload_date || ''}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Описание груза</label>
            <input
              type="text"
              name="cargo_description"
              defaultValue={order.cargo_description || ''}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* СТАТУС И ЗАМЕТКИ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>📋 Статус</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>Статус</label>
            <select name="status" className={inputClass} defaultValue={order.status || 'planned'}>
              <option value="planned">Планируется</option>
              <option value="active">В пути</option>
              <option value="completed">Завершена</option>
              <option value="invoiced">Выставлен счёт</option>
              <option value="paid">Оплачена</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Заметки</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={order.notes || ''}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* КНОПКИ */}
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
        <button
          type="submit"
          className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                     shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
        >
          ✅ Сохранить изменения
        </button>
      </div>

    </form>
  );
}
