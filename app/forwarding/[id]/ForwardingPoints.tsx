import { MapPin, Flag, Calendar, DoorOpen, User, StickyNote } from 'lucide-react';

export default function ForwardingPoints({
  loadingPoints,
  unloadingPoints,
}: {
  loadingPoints: any[];
  unloadingPoints: any[];
}) {
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-brand-600" />
        Точки маршрута
      </h2>

      <div className="mb-6">
        <div className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Погрузка
          {loadingPoints.length > 1 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {loadingPoints.length}
            </span>
          )}
        </div>
        {loadingPoints.length === 0 ? (
          <div className="text-slate-400 text-sm pl-4">Не указано</div>
        ) : (
          <div className="space-y-3">
            {loadingPoints.map((p, idx) => {
              const loc = Array.isArray(p.locations) ? p.locations[0] : p.locations;
              return (
                <div key={p.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <div className="font-bold text-slate-900 break-words">
                      {loc?.name || '—'}
                    </div>
                    {p.date && (
                      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.date).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 break-words">
                    {[loc?.postal_code, loc?.city, loc?.address, loc?.country].filter(Boolean).join(', ') || '—'}
                  </div>
                  {(p.loading_number || loc?.contact_person) && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {p.loading_number && (
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          № погрузки: <b className="text-slate-700">{p.loading_number}</b>
                        </span>
                      )}
                      {loc?.contact_person && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {loc.contact_person}
                        </span>
                      )}
                    </div>
                  )}
                  {p.notes && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 break-words">
                      <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{p.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
          <Flag className="w-4 h-4" />
          Выгрузка
          {unloadingPoints.length > 1 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {unloadingPoints.length}
            </span>
          )}
        </div>
        {unloadingPoints.length === 0 ? (
          <div className="text-slate-400 text-sm pl-4">Не указано</div>
        ) : (
          <div className="space-y-3">
            {unloadingPoints.map((p, idx) => {
              const loc = Array.isArray(p.locations) ? p.locations[0] : p.locations;
              return (
                <div key={p.id} className="border-l-4 border-red-500 pl-4 py-2">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <div className="font-bold text-slate-900 break-words">
                      {loc?.name || '—'}
                    </div>
                    {p.date && (
                      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.date).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 break-words">
                    {[loc?.postal_code, loc?.city, loc?.address, loc?.country].filter(Boolean).join(', ') || '—'}
                  </div>
                  {(p.loading_number || loc?.contact_person) && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {p.loading_number && (
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          № выгрузки: <b className="text-slate-700">{p.loading_number}</b>
                        </span>
                      )}
                      {loc?.contact_person && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {loc.contact_person}
                        </span>
                      )}
                    </div>
                  )}
                  {p.notes && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 break-words">
                      <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{p.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
