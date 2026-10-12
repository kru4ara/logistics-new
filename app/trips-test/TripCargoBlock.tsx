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
} from 'lucide-react';
import CargoForm from './CargoForm';
import { deleteCargo } from './cargo-actions';

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
};

export default function TripCargoBlock({
  tripId,
  cargoList,
  clients,
  defaultClientId,
}: {
  tripId: string;
  cargoList: Cargo[];
  clients: ClientOption[];
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
        Каждый груз на рейсе — отдельная позиция со своим описанием. Удобно, когда рейс сборный:
        несколько грузов от разных отправителей, которые мы забираем и везём вместе.
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
          } : undefined}
          clients={clients}
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
