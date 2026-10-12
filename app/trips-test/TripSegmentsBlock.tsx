'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Flag,
  ArrowRight,
  StickyNote,
  Package,
} from 'lucide-react';
import SegmentForm from './SegmentForm';
import { deleteSegment } from './segment-actions';

type Option = { id: string; label: string };

type CargoOption = {
  id: string;
  position: number;
  label: string;
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
};

type CargoLink = {
  cargo_id: string;
  position: number;
  label: string;
};

type Segment = {
  id: string;
  position: number;
  executor_type: string;
  contractor_id: string | null;
  contractor_name: string | null;
  truck_id: string | null;
  truck_reg: string | null;
  driver_id: string | null;
  driver_name: string | null;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
  cargoLinks: CargoLink[];
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

function fmtPlace(company: string | null, city: string | null, country: string | null): string {
  const companyPart = company || '';
  const place = [city, country].filter(Boolean).join(', ');
  if (companyPart && place) return `${companyPart} · ${place}`;
  return companyPart || place || '—';
}

// Уникальные точки забора из грузов сегмента
function getUniqueFroms(cargoIds: string[], cargoList: CargoOption[]) {
  const map = new Map<string, CargoOption>();
  for (const id of cargoIds) {
    const c = cargoList.find((x) => x.id === id);
    if (!c) continue;
    const k = `${c.from_company || ''}|${c.from_city || ''}|${c.from_country || ''}|${c.from_address || ''}`;
    if (!map.has(k) && (c.from_city || c.from_country || c.from_company || c.from_address)) {
      map.set(k, c);
    }
  }
  return Array.from(map.values());
}

function getUniqueTos(cargoIds: string[], cargoList: CargoOption[]) {
  const map = new Map<string, CargoOption>();
  for (const id of cargoIds) {
    const c = cargoList.find((x) => x.id === id);
    if (!c) continue;
    const k = `${c.to_company || ''}|${c.to_city || ''}|${c.to_country || ''}|${c.to_address || ''}`;
    if (!map.has(k) && (c.to_city || c.to_country || c.to_company || c.to_address)) {
      map.set(k, c);
    }
  }
  return Array.from(map.values());
}

export default function TripSegmentsBlock({
  tripId,
  segments,
  contractors,
  trucks,
  drivers,
  cargoList,
}: {
  tripId: string;
  segments: Segment[];
  contractors: Option[];
  trucks: Option[];
  drivers: Option[];
  cargoList: CargoOption[];
}) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setEditingId(null);
    setIsFormOpen(true);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setIsFormOpen(true);
  }

  function handleClose() {
    setIsFormOpen(false);
    setEditingId(null);
  }

  function handleDelete(id: string, position: number) {
    if (!confirm(`Удалить участок №${position}?`)) return;
    setIsDeletingId(id);
    startTransition(async () => {
      try {
        await deleteSegment(id, tripId);
        router.refresh();
      } catch (e) {
        alert('Ошибка удаления: ' + (e as Error).message);
      } finally {
        setIsDeletingId(null);
      }
    });
  }

  const editingSegment = editingId
    ? segments.find((s) => s.id === editingId)
    : null;

  return (
    <div className="card p-5 md:p-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Участки рейса
          {segments.length > 0 && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
              {segments.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Добавить участок
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Кто и куда едет. Участок = одна машина (наша или подрядчика) и список грузов, которые она везёт.
        Маршрут строится автоматически из адресов грузов.
      </p>

      {segments.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Участков пока нет. Добавьте, если рейс сборный или часть пути едет подрядчик.
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((s) => {
            const isUs = s.executor_type === 'us';
            const executorLabel = isUs
              ? `Мы · ${s.truck_reg || '—'}${s.driver_name ? ` · ${s.driver_name}` : ''}`
              : `Подрядчик · ${s.contractor_name || '—'}`;

            const cargoIds = s.cargoLinks.map((cl) => cl.cargo_id);
            const uniqueFroms = getUniqueFroms(cargoIds, cargoList);
            const uniqueTos = getUniqueTos(cargoIds, cargoList);

            return (
              <div
                key={s.id}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 tabular-nums
                    ${isUs ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'}`}>
                    {s.position}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold
                        ${isUs ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                        {isUs ? (
                          <Truck className="w-3 h-3" strokeWidth={2.2} />
                        ) : (
                          <Users className="w-3 h-3" strokeWidth={2.2} />
                        )}
                        {executorLabel}
                      </span>

                      {(s.date_from || s.date_to) && (
                        <span className="text-xs text-slate-500 tabular-nums">
                          {s.date_from && fmtDate(s.date_from)}
                          {s.date_from && s.date_to && ' → '}
                          {s.date_to && fmtDate(s.date_to)}
                        </span>
                      )}
                    </div>

                    {/* Маршруты из грузов */}
                    <div className="flex flex-col gap-2 text-sm">
                      {uniqueFroms.length > 0 && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="min-w-0 flex-1">
                            {uniqueFroms.length === 1 ? (
                              <span className="text-slate-700 break-words">
                                {fmtPlace(uniqueFroms[0].from_company, uniqueFroms[0].from_city, uniqueFroms[0].from_country)}
                                {uniqueFroms[0].from_address ? ` · ${uniqueFroms[0].from_address}` : ''}
                              </span>
                            ) : (
                              <>
                                <div className="text-[10px] uppercase tracking-wide text-green-700 font-semibold mb-0.5">
                                  Забирает из {uniqueFroms.length} точек
                                </div>
                                <div className="space-y-1">
                                  {uniqueFroms.map((c, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs">
                                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                                        {i + 1}
                                      </span>
                                      <span className="text-slate-700 break-words">
                                        {fmtPlace(c.from_company, c.from_city, c.from_country)}
                                        {c.from_address ? ` · ${c.from_address}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {uniqueTos.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Flag className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="min-w-0 flex-1">
                            {uniqueTos.length === 1 ? (
                              <span className="text-slate-700 break-words">
                                {fmtPlace(uniqueTos[0].to_company, uniqueTos[0].to_city, uniqueTos[0].to_country)}
                                {uniqueTos[0].to_address ? ` · ${uniqueTos[0].to_address}` : ''}
                              </span>
                            ) : (
                              <>
                                <div className="text-[10px] uppercase tracking-wide text-red-700 font-semibold mb-0.5">
                                  Везёт в {uniqueTos.length} точек
                                </div>
                                <div className="space-y-1">
                                  {uniqueTos.map((c, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs">
                                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                                        {i + 1}
                                      </span>
                                      <span className="text-slate-700 break-words">
                                        {fmtPlace(c.to_company, c.to_city, c.to_country)}
                                        {c.to_address ? ` · ${c.to_address}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {(uniqueFroms.length === 0 && uniqueTos.length === 0) && (
                        <div className="text-xs text-slate-400 italic">
                          У привязанных грузов не заполнены адреса — маршрут не построен
                        </div>
                      )}
                    </div>

                    {/* Список грузов */}
                    {s.cargoLinks.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/60">
                        <Package className="w-3 h-3 text-slate-400 shrink-0" strokeWidth={2} />
                        {s.cargoLinks.map((cl) => (
                          <span
                            key={cl.cargo_id}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 rounded-full px-2 py-0.5"
                          >
                            <span className="font-bold text-brand-600 tabular-nums">#{cl.position}</span>
                            <span className="text-slate-600 truncate max-w-[140px]">{cl.label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {s.notes && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100 break-words">
                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={2} />
                        <span>{s.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(s.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600
                                 hover:bg-white text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                      title="Изменить"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.position)}
                      disabled={isDeletingId === s.id || isPending}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200
                                 hover:bg-red-100 text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                      title="Удалить"
                    >
                      {isDeletingId === s.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <SegmentForm
          tripId={tripId}
          segmentId={editingId || undefined}
          initialData={editingSegment ? {
            executor_type: editingSegment.executor_type,
            contractor_id: editingSegment.contractor_id,
            truck_id: editingSegment.truck_id,
            driver_id: editingSegment.driver_id,
            date_from: editingSegment.date_from,
            date_to: editingSegment.date_to,
            notes: editingSegment.notes,
          } : undefined}
          initialCargoIds={editingSegment?.cargoLinks.map((cl) => cl.cargo_id) || []}
          contractors={contractors}
          trucks={trucks}
          drivers={drivers}
          cargoList={cargoList}
          onClose={handleClose}
          onSaved={() => {
            handleClose();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
