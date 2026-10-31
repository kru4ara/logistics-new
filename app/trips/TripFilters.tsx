'use client';

import { useRouter } from 'next/navigation';
import { User, Truck, Calendar, ArrowUpDown, Package } from 'lucide-react';

type Option = { id: string; label: string };

export default function TripFilters({
  clients,
  drivers,
  tractors,
  years,
  months,
  currentYear,
  currentMonth,
  currentClient,
  currentDriver,
  currentTruck,
  currentSort,
  currentMode,
}: {
  clients: Option[];
  drivers: Option[];
  tractors: Option[];
  years: number[];
  months: string[];
  currentYear: number;
  currentMonth: number | null;
  currentClient: string | null;
  currentDriver: string | null;
  currentTruck: string | null;
  currentSort: string;
  currentMode: string | null;
}) {
  const router = useRouter();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/trips?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      
      {/* ЛЕВАЯ КОЛОНКА */}
      <div className="space-y-4">
        {clients.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Клиент
            </div>
            <select
              className="input text-sm py-2"
              value={currentClient || ''}
              onChange={(e) => updateParam('client', e.target.value || null)}
            >
              <option value="">Все клиенты</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {drivers.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Водитель
            </div>
            <select
              className="input text-sm py-2"
              value={currentDriver || ''}
              onChange={(e) => updateParam('driver', e.target.value || null)}
            >
              <option value="">Все водители</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {tractors.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> Тягач
            </div>
            <select
              className="input text-sm py-2"
              value={currentTruck || ''}
              onChange={(e) => updateParam('truck', e.target.value || null)}
            >
              <option value="">Все тягачи</option>
              {tractors.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА */}
      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Год / Месяц
          </div>
          <div className="flex gap-2">
            <select
              className="input text-sm py-2 flex-1"
              value={String(currentYear)}
              onChange={(e) => updateParam('year', e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              className="input text-sm py-2 flex-1"
              value={currentMonth || ''}
              onChange={(e) => updateParam('month', e.target.value || null)}
            >
              <option value="">Все месяцы</option>
              {months.map((mn, i) => (
                <option key={i+1} value={i+1}>{mn}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Режим расчёта
          </div>
          <select
            className="input text-sm py-2"
            value={currentMode || ''}
            onChange={(e) => updateParam('mode', e.target.value || null)}
          >
            <option value="">Все заказы</option>
            <option value="trip">Рейсы</option>
            <option value="forwarding">Экспедирование</option>
          </select>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5" /> Сортировка
          </div>
          <select
            className="input text-sm py-2"
            value={currentSort}
            onChange={(e) => updateParam('sort', e.target.value === 'created' ? 'created' : null)}
          >
            <option value="start">По дате старта</option>
            <option value="created">Последние созданные</option>
          </select>
        </div>
      </div>
    </div>
  );
}
