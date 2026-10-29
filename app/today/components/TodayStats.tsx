import { MapPin, Flag, Route as RouteIcon, AlertTriangle } from 'lucide-react';

type Props = {
  loadings: number;
  unloadings: number;
  active: number;
  attention: number;
};

/** Счётчики: загрузки, выгрузки, в пути, требует внимания. */
export default function TodayStats({ loadings, unloadings, active, attention }: Props) {
  return (
<div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Загрузок</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 md:w-[18px] md:h-[18px] text-green-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-green-600 tabular-nums">
              {loadings}
            </div>
          </div>

          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Выгрузок</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Flag className="w-4 h-4 md:w-[18px] md:h-[18px] text-red-500" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500 tabular-nums">
              {unloadings}
            </div>
          </div>

          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">В пути</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <RouteIcon className="w-4 h-4 md:w-[18px] md:h-[18px] text-brand-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {active}
            </div>
          </div>

          <div className={`card card-hover p-4 md:p-5 ${attention > 0 ? 'border-amber-200' : ''}`}>
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className={`text-xs md:text-sm font-medium ${attention > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                Требует внимания
              </span>
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center
                ${attention > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <AlertTriangle className={`w-4 h-4 md:w-[18px] md:h-[18px] ${attention > 0 ? 'text-amber-600' : 'text-slate-400'}`} strokeWidth={2.2} />
              </div>
            </div>
            <div className={`text-2xl md:text-3xl font-bold tabular-nums ${attention > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {attention}
            </div>
          </div>
        </div>
  );
}
