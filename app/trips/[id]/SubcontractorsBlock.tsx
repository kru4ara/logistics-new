'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Loader2,
  StickyNote,
} from 'lucide-react';
import SubcontractorForm from './SubcontractorForm';
import type { SenderPoint } from './SubcontractorForm';
import { deleteTripSubcontractor } from '../../../lib/trip-subcontractors';

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

type Contractor = {
  id: string;
  name: string;
  full_name: string | null;
  country: string | null;
  address: string | null;
  tax_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
};

type Subcontractor = {
  id: string;
  trip_id: string;
  contractor_id: string | null;
  position: number;
  price_eur: number;
  original_price: number;
  currency: string;
  payment_days: number | null;
  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  load_date: string | null;
  load_country: string | null;
  load_city: string | null;
  load_address: string | null;
  load_company: string | null;
  load_postal_code: string | null;
  load_number: string | null;
  load2_date: string | null;
  load2_country: string | null;
  load2_city: string | null;
  load2_address: string | null;
  load2_company: string | null;
  load2_postal_code: string | null;
  load2_number: string | null;
  load3_date: string | null;
  load3_country: string | null;
  load3_city: string | null;
  load3_address: string | null;
  load3_company: string | null;
  load3_postal_code: string | null;
  load3_number: string | null;
  load4_date: string | null;
  load4_country: string | null;
  load4_city: string | null;
  load4_address: string | null;
  load4_company: string | null;
  load4_postal_code: string | null;
  load4_number: string | null;
  load5_date: string | null;
  load5_country: string | null;
  load5_city: string | null;
  load5_address: string | null;
  load5_company: string | null;
  load5_postal_code: string | null;
  load5_number: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
  unload_date: string | null;
  notes: string | null;
  transport_type: string | null;
  transport_temperature: string | null;
  cargo_type: string | null;
  cargo_quantity: string | null;
  customs_loading: string | null;
  customs_unloading: string | null;
  contractors?: { name: string; country: string | null } | { name: string; country: string | null }[] | null;
};

type DefaultLoad = {
  country: string | null;
  city: string | null;
  address: string | null;
  company: string | null;
  postal_code: string | null;
  loading_number: string | null;
};

type DisplayLoadPoint = {
  num: number;
  date: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  company: string | null;
  postal_code: string | null;
  number: string | null;
};

function extractLoadPoints(sub: Subcontractor): DisplayLoadPoint[] {
  const raw: DisplayLoadPoint[] = [
    { num: 1, date: sub.load_date,  country: sub.load_country,  city: sub.load_city,  address: sub.load_address,  company: sub.load_company,  postal_code: sub.load_postal_code,  number: sub.load_number },
    { num: 2, date: sub.load2_date, country: sub.load2_country, city: sub.load2_city, address: sub.load2_address, company: sub.load2_company, postal_code: sub.load2_postal_code, number: sub.load2_number },
    { num: 3, date: sub.load3_date, country: sub.load3_country, city: sub.load3_city, address: sub.load3_address, company: sub.load3_company, postal_code: sub.load3_postal_code, number: sub.load3_number },
    { num: 4, date: sub.load4_date, country: sub.load4_country, city: sub.load4_city, address: sub.load4_address, company: sub.load4_company, postal_code: sub.load4_postal_code, number: sub.load4_number },
    { num: 5, date: sub.load5_date, country: sub.load5_country, city: sub.load5_city, address: sub.load5_address, company: sub.load5_company, postal_code: sub.load5_postal_code, number: sub.load5_number },
  ];

  return raw
    .filter(
      (p) =>
        p.date || p.city || p.country || p.address || p.company || p.postal_code || p.number
    )
    .map((p, idx) => ({ ...p, num: idx + 1 }));
}

function getContractorName(rel: Subcontractor['contractors']): { name: string; country: string | null } {
  if (!rel) return { name: '—', country: null };
  if (Array.isArray(rel)) return rel[0] || { name: '—', country: null };
  return rel;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

export default function SubcontractorsBlock({
  tripId,
  subcontractors,
  contractors,
  loadingLocations,
  unloadingLocations,
  defaultLoad,
  senderPoints,
  tripFinalDestination,
}: {
  tripId: string;
  subcontractors: Subcontractor[];
  contractors: Contractor[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  defaultLoad: DefaultLoad;
  senderPoints?: SenderPoint[];
  tripFinalDestination: string;
}) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить подрядчика «${name}»? Расход по нему тоже удалится.`)) return;
    setIsDeletingId(id);
    try {
      await deleteTripSubcontractor(id, tripId);
      router.refresh();
    } catch (e) {
      alert('Ошибка удаления: ' + (e as Error).message);
    } finally {
      setIsDeletingId(null);
    }
  }

  const editingSub = editingId
    ? subcontractors.find((s) => s.id === editingId)
    : null;

  return (
    <div className="card p-5 md:p-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand-600" />
          Подрядчики на рейсе
          {subcontractors.length > 0 && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
              {subcontractors.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Подрядчик везёт часть маршрута — от точки A до промежуточной точки C. Дальше до конечной точки рейса
        груз едет нашими машинами. Расход идёт в экономику рейса, но не в статистику экспедирования.
      </p>

      {subcontractors.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Подрядчики не добавлены. Добавьте, если часть маршрута выполняет наёмный перевозчик.
        </div>
      ) : (
        <div className="space-y-3">
          {subcontractors.map((sub) => {
            const cInfo = getContractorName(sub.contractors);
            const loadPoints = extractLoadPoints(sub);
            const toLine = [sub.unload_country, sub.unload_city].filter(Boolean).join(', ') || '—';

            return (
              <div
                key={sub.id}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 break-words">
                      {cInfo.name}
                      {cInfo.country && (
                        <span className="text-xs text-slate-500 font-normal ml-2">
                          · {cInfo.country}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-red-500">
                      {sub.original_price} {sub.currency}
                    </div>
                    <div className="text-xs text-slate-400">
                      ≈ {sub.price_eur.toFixed(2)} €
                    </div>
                  </div>
                </div>

                {/* Визуальная схема A1 → A2 → ... → C */}
                <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      {loadPoints.length === 0 ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="w-0.5 flex-1 bg-slate-200 my-0.5" style={{ minHeight: 16 }} />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        </>
                      ) : (
                        <>
                          {loadPoints.map((p, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                              <span
                                className="w-0.5 flex-1 bg-slate-200 my-0.5"
                                style={{ minHeight: 16 }}
                              />
                            </div>
                          ))}
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        </>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {loadPoints.length === 0 ? (
                        <div>
                          <div className="font-semibold text-green-700">A · Загрузка</div>
                          <div className="text-slate-700 break-words">—</div>
                          <div className="text-slate-500 break-words">—</div>
                        </div>
                      ) : (
                        loadPoints.map((p, idx) => {
                          const fromLine = [p.country, p.city].filter(Boolean).join(', ') || '—';
                          return (
                            <div key={idx}>
                              <div className="font-semibold text-green-700 flex items-center gap-2 flex-wrap">
                                A{p.num} · Загрузка
                                {p.date && (
                                  <span className="font-normal text-slate-500">· {fmtDate(p.date)}</span>
                                )}
                              </div>
                              <div className="text-slate-700 break-words">{p.company || '—'}</div>
                              <div className="text-slate-500 break-words">{fromLine}</div>
                              {p.address && (
                                <div className="text-slate-400 break-words">{p.address}</div>
                              )}
                              {p.number && (
                                <div className="text-slate-400 text-[11px]">
                                  № погрузки: {p.number}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      <div>
                        <div className="font-semibold text-amber-700 flex items-center gap-2 flex-wrap">
                          C · Перегрузка (куда довозит подрядчик)
                          {sub.unload_date && (
                            <span className="font-normal text-slate-500">· {fmtDate(sub.unload_date)}</span>
                          )}
                        </div>
                        <div className="text-slate-700 break-words">{sub.unload_company || '—'}</div>
                        <div className="text-slate-500 break-words">{toLine}</div>
                        {sub.unload_address && (
                          <div className="text-slate-400 break-words">{sub.unload_address}</div>
                        )}
                        {sub.unload_number && (
                          <div className="text-slate-400 text-[11px]">
                            № выгрузки: {sub.unload_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {tripFinalDestination && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-start gap-2">
                      <Truck className="w-3.5 h-3.5 shrink-0 text-brand-600 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-brand-700">Дальше мы сами — до точки Б</div>
                        <div className="text-slate-500 break-words">{tripFinalDestination}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-xs">
                  <div>
                    <div className="text-slate-400">Машина</div>
                    <div className="text-slate-700 font-medium">{sub.truck_number || '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Водитель</div>
                    <div className="text-slate-700 font-medium">{sub.driver_name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Телефон</div>
                    <div className="text-slate-700 font-medium">
                      {sub.driver_phone ? (
                        <a href={`tel:${sub.driver_phone}`} className="hover:text-brand-600 transition-colors">
                          {sub.driver_phone}
                        </a>
                      ) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Оплата</div>
                    <div className="text-slate-700 font-medium">
                      {sub.payment_days ? `${sub.payment_days} дн.` : '—'}
                    </div>
                  </div>
                </div>

                {sub.notes && (
                  <div className="flex items-start gap-2 text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100 break-words">
                    <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                    <span>{sub.notes}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                  <a
                    href={`/api/trips/${tripId}/subcontractor/${sub.id}/docx?t=${Date.now()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200
                               hover:bg-brand-100 text-xs font-medium transition-all active:scale-[0.97]"
                  >
                    <Printer className="w-3 h-3" />
                    Заявка DOCX
                  </a>
                  <button
                    type="button"
                    onClick={() => handleEdit(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700
                               hover:bg-white text-xs font-medium transition-all active:scale-[0.97]"
                  >
                    <Pencil className="w-3 h-3" />
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sub.id, cInfo.name)}
                    disabled={isDeletingId === sub.id}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200
                               hover:bg-red-100 text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    {isDeletingId === sub.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Удаление…
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        Удалить
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <SubcontractorForm
          tripId={tripId}
          contractors={contractors}
          loadingLocations={loadingLocations}
          unloadingLocations={unloadingLocations}
          defaultLoad={defaultLoad}
          senderPoints={senderPoints}
          subcontractorId={editingId || undefined}
          initialData={editingSub ? {
            contractor_id: editingSub.contractor_id,
            original_price: editingSub.original_price,
            currency: editingSub.currency,
            payment_days: editingSub.payment_days || 30,
            truck_number: editingSub.truck_number,
            driver_name: editingSub.driver_name,
            driver_phone: editingSub.driver_phone,

            load_date: editingSub.load_date,
            load_country: editingSub.load_country,
            load_city: editingSub.load_city,
            load_address: editingSub.load_address,
            load_company: editingSub.load_company,
            load_postal_code: editingSub.load_postal_code,
            load_number: editingSub.load_number,

            load2_date: editingSub.load2_date,
            load2_country: editingSub.load2_country,
            load2_city: editingSub.load2_city,
            load2_address: editingSub.load2_address,
            load2_company: editingSub.load2_company,
            load2_postal_code: editingSub.load2_postal_code,
            load2_number: editingSub.load2_number,

            load3_date: editingSub.load3_date,
            load3_country: editingSub.load3_country,
            load3_city: editingSub.load3_city,
            load3_address: editingSub.load3_address,
            load3_company: editingSub.load3_company,
            load3_postal_code: editingSub.load3_postal_code,
            load3_number: editingSub.load3_number,

            load4_date: editingSub.load4_date,
            load4_country: editingSub.load4_country,
            load4_city: editingSub.load4_city,
            load4_address: editingSub.load4_address,
            load4_company: editingSub.load4_company,
            load4_postal_code: editingSub.load4_postal_code,
            load4_number: editingSub.load4_number,

            load5_date: editingSub.load5_date,
            load5_country: editingSub.load5_country,
            load5_city: editingSub.load5_city,
            load5_address: editingSub.load5_address,
            load5_company: editingSub.load5_company,
            load5_postal_code: editingSub.load5_postal_code,
            load5_number: editingSub.load5_number,

            unload_country: editingSub.unload_country,
            unload_city: editingSub.unload_city,
            unload_address: editingSub.unload_address,
            unload_company: editingSub.unload_company,
            unload_postal_code: editingSub.unload_postal_code,
            unload_number: editingSub.unload_number,
            unload_date: editingSub.unload_date,

            notes: editingSub.notes,
            transport_type: editingSub.transport_type,
            transport_temperature: editingSub.transport_temperature,
            cargo_type: editingSub.cargo_type,
            cargo_quantity: editingSub.cargo_quantity,
            customs_loading: editingSub.customs_loading,
            customs_unloading: editingSub.customs_unloading,
          } : undefined}
          onClose={handleClose}
          onSaved={handleClose}
        />
      )}
    </div>
  );
}
