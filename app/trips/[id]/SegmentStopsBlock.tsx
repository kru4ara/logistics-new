'use client';

import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { Location, Stop } from './types';

const STOP_TYPE_COLORS: Record<Stop['type'], string> = {
  load: 'bg-green-100 text-green-800 border-green-300',
  reload: 'bg-amber-100 text-amber-800 border-amber-300',
  unload: 'bg-red-100 text-red-800 border-red-300',
  customs: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function SegmentStopsBlock({
  stops,
  loadingLocations,
  unloadingLocations,
  customsLocations,
  onAdd,
  onRemove,
  onUpdate,
  onFillFromLocation,
}: {
  stops: Stop[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: keyof Stop, value: string) => void;
  onFillFromLocation: (idx: number, locId: string) => void;
}) {
  return (
    <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-amber-700" strokeWidth={2.2} />
          <h4 className="text-sm font-bold text-amber-800">Промежуточные точки</h4>
          {stops.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium tabular-nums">
              {stops.length}
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-amber-700">
        Заезды по пути (догруз, перегруз, таможня, промежуточная выгрузка). Если машина везёт без остановок — оставьте пустым.
      </p>

      {stops.map((stop, idx) => (
        <div
          key={idx}
          className="bg-white rounded-lg border border-amber-200 p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded tabular-nums">
                #{idx + 1}
              </span>
              <select
                value={stop.type}
                onChange={(e) => onUpdate(idx, 'type', e.target.value)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer ${STOP_TYPE_COLORS[stop.type]}`}
              >
                <option value="load">Загрузка</option>
                <option value="reload">Догруз / перегруз</option>
                <option value="unload">Выгрузка</option>
                <option value="customs">Таможня</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="text-red-600 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" strokeWidth={2.2} />
              Удалить
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Подставить из справочника</label>
            <select
              onChange={(e) => {
                onFillFromLocation(idx, e.target.value);
                e.target.value = '';
              }}
              className="w-full rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 px-2 py-1.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              defaultValue=""
            >
              <option value="">— Выберите локацию —</option>
              {(() => {
                let filtered: Location[] = [];
                if (stop.type === 'customs') {
                  filtered = customsLocations;
                } else if (stop.type === 'load') {
                  filtered = loadingLocations;
                } else if (stop.type === 'unload') {
                  filtered = unloadingLocations;
                } else {
                  filtered = loadingLocations.filter((l) => l.type === 'both');
                }

                return filtered.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.city ? `· ${loc.city}` : ''}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Компания</label>
              <input
                type="text"
                value={stop.company}
                onChange={(e) => onUpdate(idx, 'company', e.target.value)}
                placeholder="KAMEX Sp. z o.o."
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Страна</label>
              <input
                type="text"
                value={stop.country}
                onChange={(e) => onUpdate(idx, 'country', e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Город</label>
              <input
                type="text"
                value={stop.city}
                onChange={(e) => onUpdate(idx, 'city', e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Почтовый код</label>
              <input
                type="text"
                value={stop.postal_code}
                onChange={(e) => onUpdate(idx, 'postal_code', e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Адрес</label>
              <input
                type="text"
                value={stop.address}
                onChange={(e) => onUpdate(idx, 'address', e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Дата</label>
              <input
                type="date"
                value={stop.date}
                onChange={(e) => onUpdate(idx, 'date', e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="w-full py-2.5 rounded-lg border-2 border-dashed border-amber-300 text-amber-800 font-medium text-sm
                   hover:bg-amber-100 hover:border-amber-400 transition-all active:scale-[0.99]
                   inline-flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} />
        Добавить промежуточную точку
      </button>
    </div>
  );
}
