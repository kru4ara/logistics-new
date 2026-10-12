'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  StickyNote,
  User as UserIcon,
  MapPin,
  Flag,
  ArrowRight,
} from 'lucide-react';
import CargoForm from './CargoForm';
import { deleteCargo } from './cargo-actions';

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

type ClientOption = { id: string; label: string };

type Cargo = {
  id: string;
  position: number;
  label: string | null;
  cargo_type: string | null;
  weight_kg: number | null;
  client_id: string | null;
  client_name: string | null;
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
};

function fmtPlace(company: string | null, city: string | null, country: string | null): string {
  const companyPart = company || '';
  const place = [city, country].filter(Boolean).join(', ');
  if (companyPart && place) return `${companyPart} · ${place}`;
  return companyPart || place || '—';
}

export default function TripCargoBlock({
  tripId,
  cargoList,
  clients,
  loadingLocations,
  unloadingLocations,
  defaultClientId,
}: {
  tripId: string;
  cargoList: Cargo[];
  clients: ClientOption[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  defaultClientId?: string | null;
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

  function handleDelete(id: string, label: string) {
    if (!confirm(`Удалить груз «${label}»?`)) return;
    setIsDeletingId(id);
    startTransition(async () => {
      try {
        await deleteCargo(id, tripId);
        router.refresh();
      } catch (e) {
        alert('Ошибка удаления: ' + (e as Error).message);
      } finally {
        setIsDeletingId(null);
      }
    });
  }

  const editingCargo = editingId
    ? cargoList.find((c) => c.id === editingId)
    : null;

  return (
    <div className="card p-5 md:p-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Грузы на рейсе
          {cargoList.length > 0 && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
              {cargoList.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Добавить груз
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Каждый груз — отдельная позиция со своим маршрутом «откуда → куда».
        Удобно, когда рейс сборный: несколько грузов от разных отправителей, которые мы везём вместе.
      </p>

      {cargoList.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Грузов пока не добавлено. Добавьте, если рейс сборный или у клиента несколько позиций.
        </div>
      ) : (
        <div className="space-y-2">
          {cargoList.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0 tabular-nums">
                {c.position}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 text-sm break-words">
                  {c.label || '—'}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  {c.cargo_type && (
                    <span>{c.cargo_type}</span>
                  )}
                  {c.weight_kg != null && (
                    <span className="tabular-nums">{c.weight_kg} кг</span>
                  )}
                  {c.client_name && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="w-3 h-3" strokeWidth={2} />
                      {c.client_name}
                    </span>
                  )}
                </div>

                {/* Маршрут груза: откуда → куда */}
                {(c.from_city || c.from_country || c.from_company || c.to_city || c.to_country || c.to_company) && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-col gap-1.5 text-xs">
                      {(c.from_city || c.from_country || c.from_company) && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 text-green-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase tracking-wide text-green-700 font-semibold">Откуда: </span>
                            <span className="text-slate-700 break-words">
                              {fmtPlace(c.from_company, c.from_city, c.from_country)}
                            </span>
                          </div>
                        </div>
                      )}
                      {(c.to_city || c.to_country || c.to_company) && (
                        <div className="flex items-start gap-1.5">
                          <Flag className="w-3 h-3 text-red-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase tracking-wide text-red-700 font-semibold">Куда: </span>
                            <span className="text-slate-700 break-words">
                              {fmtPlace(c.to_company, c.to_city, c.to_country)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {c.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-white rounded-lg p-2 mt-2 border border-slate-100 break-words">
                    <StickyNote className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={2} />
                    <span>{c.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(c.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600
                             hover:bg-white text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                  title="Изменить"
                >
                  <Pencil className="w-3 h-3" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.label || '—')}
                  disabled={isDeletingId === c.id || isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200
                             hover:bg-red-100 text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                  title="Удалить"
                >
                  {isDeletingId === c.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <CargoForm
          tripId={tripId}
          cargoId={editingId || undefined}
          initialData={editingCargo ? {
            label: editingCargo.label || '',
            cargo_type: editingCargo.cargo_type || '',
            weight_kg: editingCargo.weight_kg,
            client_id: editingCargo.client_id,
            notes: editingCargo.notes || '',
            from_country: editingCargo.from_country,
            from_city: editingCargo.from_city,
            from_company: editingCargo.from_company,
            from_address: editingCargo.from_address,
            from_postal_code: editingCargo.from_postal_code,
            to_country: editingCargo.to_country,
            to_city: editingCargo.to_city,
            to_company: editingCargo.to_company,
            to_address: editingCargo.to_address,
            to_postal_code: editingCargo.to_postal_code,
          } : undefined}
          clients={clients}
          loadingLocations={loadingLocations}
          unloadingLocations={unloadingLocations}
          defaultClientId={defaultClientId}
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
