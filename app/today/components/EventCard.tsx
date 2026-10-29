import Link from 'next/link';
import { MapPin, Flag, Truck, UserCircle } from 'lucide-react';
import { statusColors, statusLabels, type EventItem } from '../lib/events';

/** Карточка события загрузки/выгрузки. */
export default function EventCard({ e, accent }: { e: EventItem; accent: 'load' | 'unload' }) {
  const accentBorder = accent === 'load' ? 'border-l-green-500' : 'border-l-red-500';
  const accentBg = accent === 'load' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  const Icon = accent === 'load' ? MapPin : Flag;

  return (
    <Link
      href={e.href}
      className={`group block card card-hover overflow-hidden border-l-4 ${accentBorder} active:scale-[0.99]`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${accentBg}`}>
              <Icon className="w-3 h-3" strokeWidth={2.5} />
              {e.pointLabel}
            </span>
            <span className="text-xs text-slate-400 font-medium tabular-nums">
              Рейс {e.tripNumber}
            </span>
          </div>
          {e.tripStatus && (
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
                              ${statusColors[e.tripStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[e.tripStatus] || e.tripStatus}
            </span>
          )}
        </div>

        {e.clientName && (
          <div className="font-bold text-slate-900 text-sm break-words group-hover:text-brand-600 transition-colors mb-1">
            {e.clientName}
          </div>
        )}

        {e.company && (
          <div className="text-sm text-slate-700 break-words">{e.company}</div>
        )}

        <div className="text-xs text-slate-500 mt-1 break-words">
          {[e.city, e.country].filter(Boolean).join(', ') || '—'}
        </div>

        {(e.driverName || e.truckNumber) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            {e.truckNumber && (
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3 h-3" strokeWidth={2} />
                <b className="text-slate-700">{e.truckNumber}</b>
              </span>
            )}
            {e.driverName && (
              <span className="inline-flex items-center gap-1">
                <UserCircle className="w-3 h-3" strokeWidth={2} />
                {e.driverName}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  
  );
}
