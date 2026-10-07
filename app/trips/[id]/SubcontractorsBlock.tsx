'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubcontractorForm from './SubcontractorForm';
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
  unload_date: string | null;
  load_country: string | null;
  load_city: string | null;
  load_address: string | null;
  load_company: string | null;
  load_postal_code: string | null;
  load_number: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
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
  tripFinalDestination,
}: {
  tripId: string;
  subcontractors: Subcontractor[];
  contractors: Contractor[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  defaultLoad: DefaultLoad;
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          🚛 Подрядчики на рейсе
          {subcontractors.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {subcontractors.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm
                     shadow-md shadow-blue-600/20 transition-all active:scale-[0.98]"
        >
          ➕ Добавить
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

            const fromLine = [sub.load_country, sub.load_city].filter(Boolean).join(', ') || '—';
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

                {/* Визуальная схема A → C */}
                <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="w-0.5 flex-1 bg-slate-200 my-0.5" style={{ minHeight: 16 }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <div className="font-semibold text-green-700 flex items-center gap-2">
                          A · Загрузка
                          {sub.load_date && (
                            <span className="font-normal text-slate-500">· {fmtDate(sub.load_date)}</span>
                          )}
                        </div>
                        <div className="text-slate-700 break-words">{sub.load_company || '—'}</div>
                        <div className="text-slate-500 break-words">{fromLine}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-700 flex items-center gap-2">
                          C · Перегрузка (куда довозит подрядчик)
                          {sub.unload_date && (
                            <span className="font-normal text-slate-500">· {fmtDate(sub.unload_date)}</span>
                          )}
                        </div>
                        <div className="text-slate-700 break-words">{sub.unload_company || '—'}</div>
                        <div className="text-slate-500 break-words">{toLine}</div>
                      </div>
                    </div>
                  </div>

                  {tripFinalDestination && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-start gap-2">
                      <span className="shrink-0 text-blue-600">🚛</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-blue-700">Дальше мы сами — до точки Б</div>
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
                        <a href={`tel:${sub.driver_phone}`} className="hover:text-blue-600">
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
                  <div className="text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100 break-words">
                    📝 {sub.notes}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                  <a
                    href={`/api/trips/${tripId}/subcontractor/${sub.id}/docx?t=${Date.now()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200
                               hover:bg-blue-100 text-xs font-medium transition-all"
                  >
                    🖨 Заявка DOCX
                  </a>
                  <button
                    type="button"
                    onClick={() => handleEdit(sub.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700
                               hover:bg-white text-xs font-medium transition-all"
                  >
                    ✏️ Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sub.id, cInfo.name)}
                    disabled={isDeletingId === sub.id}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200
                               hover:bg-red-100 text-xs font-medium transition-all disabled:opacity-50
                               ml-auto"
                  >
                    {isDeletingId === sub.id ? '⏳ Удаление…' : '🗑 Удалить'}
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
            unload_date: editingSub.unload_date,
            load_country: editingSub.load_country,
            load_city: editingSub.load_city,
            load_address: editingSub.load_address,
            load_company: editingSub.load_company,
            load_postal_code: editingSub.load_postal_code,
            load_number: editingSub.load_number,
            unload_country: editingSub.unload_country,
            unload_city: editingSub.unload_city,
            unload_address: editingSub.unload_address,
            unload_company: editingSub.unload_company,
            unload_postal_code: editingSub.unload_postal_code,
            unload_number: editingSub.unload_number,
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
