'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubcontractorForm from './SubcontractorForm';
import { deleteTripSubcontractor } from '../../../lib/trip-subcontractors';

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
  contractors?: { name: string; country: string | null } | { name: string; country: string | null }[] | null;
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
}: {
  tripId: string;
  subcontractors: Subcontractor[];
  contractors: Contractor[];
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

      {subcontractors.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Подрядчики не добавлены. Добавьте, если часть маршрута выполняет наёмный перевозчик.
        </div>
      ) : (
        <div className="space-y-3">
          {subcontractors.map((sub) => {
            const cInfo = getContractorName(sub.contractors);
            const route = [
              [sub.load_country, sub.load_city].filter(Boolean).join(', '),
              [sub.unload_country, sub.unload_city].filter(Boolean).join(', '),
            ].filter(Boolean).join(' → ') || '—';

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
                    <div className="text-xs text-slate-500 mt-1">
                      🛣 {route}
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

                <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-xs">
                  <div>
                    <div className="text-slate-400">Погрузка</div>
                    <div className="text-slate-700 font-medium">{fmtDate(sub.load_date)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Выгрузка</div>
                    <div className="text-slate-700 font-medium">{fmtDate(sub.unload_date)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Машина</div>
                    <div className="text-slate-700 font-medium">{sub.truck_number || '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Водитель</div>
                    <div className="text-slate-700 font-medium">{sub.driver_name || '—'}</div>
                  </div>
                </div>

                {sub.driver_phone && (
                  <div className="text-xs text-slate-500">
                    📞 <a href={`tel:${sub.driver_phone}`} className="hover:text-blue-600">{sub.driver_phone}</a>
                  </div>
                )}

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
          } : undefined}
          onClose={handleClose}
          onSaved={handleClose}
        />
      )}
    </div>
  );
}
