'use client';

import { MapPin, Wand2 } from 'lucide-react';
import type { Location, CargoOption, Addr } from './types'; // <-- нужно будет создать файл с типами

export default function SegmentAddressBlock({
  type,
  title,
  color,
  data,
  onChange,
  locations,
  cargoList,
  onFillFromCargo,
  onFillFromLocation,
}: {
  type: 'from' | 'to';
  title: string;
  color: 'green' | 'red';
  data: Addr;
  onChange: (data: Addr) => void;
  locations: Location[];
  cargoList: CargoOption[];
  onFillFromCargo: (cargoId: string) => void;
  onFillFromLocation: (locId: string) => void;
}) {
  const Icon = type === 'from' ? MapPin : MapPin; // можно использовать Flag для 'to'
  const bgClass = color === 'green' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const iconColor = color === 'green' ? 'text-green-700' : 'text-red-700';
  const titleColor = color === 'green' ? 'text-green-800' : 'text-red-800';
  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  function handleChange(field: keyof Addr, value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className={`${bgClass} rounded-xl p-4 space-y-3 border`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.2} />
        <h4 className={`text-sm font-bold ${titleColor}`}>{title}</h4>
      </div>

      {cargoList.length > 0 && (
        <div>
          <label className={`text-xs font-semibold ${titleColor} mb-1 flex items-center gap-1.5`}>
            <Wand2 className="w-3.5 h-3.5" strokeWidth={2.2} />
            Подставить из груза
          </label>
          <select
            onChange={(e) => {
              onFillFromCargo(e.target.value);
              e.target.value = '';
            }}
            className="input bg-white mb-2"
            defaultValue=""
          >
            <option value="">— Выберите груз —</option>
            {cargoList.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.position} · {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Подставить из справочника</label>
        <select
          onChange={(e) => {
            onFillFromLocation(e.target.value);
            e.target.value = '';
          }}
          className={`w-full rounded-lg border-2 border-dashed px-3 py-2.5 text-base text-slate-900 font-medium focus:outline-none focus:ring-2 transition-all
            ${color === 'green' 
              ? 'border-green-300 bg-green-50 focus:ring-green-500 focus:border-green-500' 
              : 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'}`}
          defaultValue=""
        >
          <option value="">— Выберите локацию —</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} {loc.city ? `· ${loc.city}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        <div>
          <label className={labelClass}>Компания</label>
          <input
            type="text"
            value={data.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Страна</label>
          <input
            type="text"
            value={data.country}
            onChange={(e) => handleChange('country', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Город</label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Почтовый код</label>
          <input
            type="text"
            value={data.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Адрес</label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
