'use client';

import { Package } from 'lucide-react';
import type { CargoOption } from './types';

export default function SegmentCargoSelector({
  cargoList,
  selectedCargo,
  onToggle,
}: {
  cargoList: CargoOption[];
  selectedCargo: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (cargoList.length === 0) return null;

  return (
    <div className="bg-brand-50 rounded-xl p-4 space-y-3 border border-brand-200">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-brand-700" strokeWidth={2.2} />
        <h4 className="text-sm font-bold text-brand-800">Какие грузы везёт этот участок</h4>
      </div>

      <div className="space-y-1.5">
        {cargoList.map((c) => {
          const isChecked = selectedCargo.has(c.id);
          return (
            <label
              key={c.id}
              className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors
                ${isChecked ? 'bg-white border-brand-400' : 'bg-white/60 border-brand-100 hover:border-brand-300'}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(c.id)}
                className="w-4 h-4 accent-brand-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded tabular-nums">
                {c.position}
              </span>
              <span className="text-sm text-slate-800 break-words flex-1">
                {c.label}
              </span>
              <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline tabular-nums">
                {c.from_city || c.from_country || '?'} → {c.to_city || c.to_country || '?'}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
