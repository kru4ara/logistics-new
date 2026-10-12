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

type Location = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  company_name: string | null;
  postal_code: string | null;
  city: string | null;
  address: string | null;
  default_loading_number: string | null;
};

type Option = { id: string; label: string };

type CargoOption = { id: string; position: number; label: string };

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

export default function TripSegmentsBlock({
  tripId,
  segments,
  contractors,
  trucks,
  drivers,
  loadingLocations,
  unloadingLocations,
  cargoList,
}: {
  tripId: string;
  segments: Segment[];
  contractors: Option[];
  trucks: Option[];
  drivers: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
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
    if (!confirm(`Удалить сегмент №${position}?`)) return;
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
        Кто и куда едет. Участки — это весь путь каждого груза: подрядчики от отправителей,
        догрузы, довозка до получателя. Если у рейса всё просто (мы едем A → Б) — оставьте пустым.
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

                  <div className="min-w-0 flex-1 space-y-2">
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

                    {/* Маршрут сегмента */}
                    <div className="flex flex-col gap-1.5">
                      {(s.from_city || s.from_country || s.from_company) && (
                        <div className="flex items-start gap-1.5 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <span className="text-slate-700 break-words">
                            {fmtPlace(s.from_company, s.from_city, s.from_country)}
                          </span>
                        </div>
                      )}
                      {(s.to_city || s.to_country || s.to_company) && (
                        <div className="flex items-start gap-1.5 text-sm">
                          <Flag className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <span className="text-slate-700 break-words">
                            {fmtPlace(s.to_company, s.to_city, s.to_country)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Грузы */}
                    {s.cargoLinks.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
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
            from_country: editingSegment.from_country,
            from_city: editingSegment.from_city,
            from_company: editingSegment.from_company,
            from_address: editingSegment.from_address,
            from_postal_code: editingSegment.from_postal_code,
            to_country: editingSegment.to_country,
            to_city: editingSegment.to_city,
            to_company: editingSegment.to_company,
            to_address: editingSegment.to_address,
            to_postal_code: editingSegment.to_postal_code,
          } : undefined}
          initialCargoIds={editingSegment?.cargoLinks.map((cl) => cl.cargo_id) || []}
          contractors={contractors}
          trucks={trucks}
          drivers={drivers}
          loadingLocations={loadingLocations}
          unloadingLocations={unloadingLocations}
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
