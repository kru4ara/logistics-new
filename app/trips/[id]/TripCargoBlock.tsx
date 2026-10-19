'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Flag,
  Loader2,
  ShieldCheck,
  Coins,
  Weight,
  Layers,
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

type CargoCard = {
  id: string;
  position: number;
  label: string;
  cargo_type: string | null;
  weight_kg: number | null;
  pallets?: number | null;
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
  customs_place?: string | null;
  customs_country?: string | null;
  customs_city?: string | null;
  customs_postal_code?: string | null;
  customs_address?: string | null;
  freight_amount?: number | null;
  freight_currency?: string | null;
};

function fmtPlace(
  company: string | null,
  city: string | null,
  country: string | null,
  address?: string | null
): string {
  const parts = [company, city, country].filter(Boolean);
  const base = parts.join(', ');
  if (address) return base ? `${base} · ${address}` : address;
  return base || '—';
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  PLN: 'zł',
  BYN: 'Br',
};

export default function TripCargoBlock({
  tripId,
  cargoList,
  clients,
  loadingLocations,
  unloadingLocations,
  customsLocations,
  defaultClientId,
}: {
  tripId: string;
  cargoList: CargoCard[];
  clients: ClientOption[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
  defaultClientId: string | null;
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

  const editingInitialData = editingCargo
    ? {
        label: editingCargo.label,
        cargo_type: editingCargo.cargo_type || '',
        weight_kg: editingCargo.weight_kg,
        pallets: editingCargo.pallets ?? null,
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
        customs_place: editingCargo.customs_place,
        customs_country: editingCargo.customs_country,
        customs_city: editingCargo.customs_city,
        customs_postal_code: editingCargo.customs_postal_code,
        customs_address: editingCargo.customs_address,
        freight_amount: editingCargo.freight_amount,
        freight_currency: editingCargo.freight_currency,
      }
    : undefined;

  return (
    <div className="card p-5 md:p-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Грузы
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
        Данные заявки: маршрут, клиент, вес, паллеты, таможня и фрахт.
      </p>

      {cargoList.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Грузов пока нет. Добавьте первый груз, чтобы указать маршрут и данные заявки.
        </div>
      ) : (
        <div className="space-y-3">
          {cargoList.map((c) => {
            const currencySymbol = CURRENCY_SYMBOLS[c.freight_currency || 'EUR'] || c.freight_currency || '€';
            
            return (
              <div
                key={c.id}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0 tabular-nums mt-0.5">
                    {c.position}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {/* Заголовок и кнопки */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-base break-words">
                          {c.label}
                        </div>
                        {c.client_name && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Клиент: <b className="text-slate-700">{c.client_name}</b>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleEdit(c.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600
                                     hover:bg-white text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                        >
                          <Pencil className="w-3 h-3" strokeWidth={2.2} />
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.label)}
                          disabled={isDeletingId === c.id || isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200
                                     hover:bg-red-100 text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                        >
                          {isDeletingId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                          )}
                          Удалить
                        </button>
                      </div>
                    </div>

                    {/* Маршрут */}
                    <div className="space-y-2">
                      {(c.from_city || c.from_country || c.from_company) && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="text-sm text-slate-700 break-words">
                            {fmtPlace(c.from_company, c.from_city, c.from_country, c.from_address)}
                          </div>
                        </div>
                      )}

                      {(c.customs_place || c.customs_city || c.customs_country) && (
                        <div className="flex items-start gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="text-sm text-slate-700 break-words">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1.5">Таможня:</span>
                            {fmtPlace(
                                c.customs_place ?? null,
                                c.customs_city ?? null,
                                c.customs_country ?? null,
                                c.customs_address ?? null
                            )}
                          </div>
                        </div>
                      )}

                      {(c.to_city || c.to_country || c.to_company) && (
                        <div className="flex items-start gap-1.5">
                          <Flag className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" strokeWidth={2.2} />
                          <div className="text-sm text-slate-700 break-words">
                            {fmtPlace(c.to_company, c.to_city, c.to_country, c.to_address)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Характеристики груза и Фрахт */}
                    {(c.weight_kg || c.pallets || c.cargo_type || c.freight_amount) && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                        {c.cargo_type && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                            Тип: {c.cargo_type}
                          </span>
                        )}
                        {c.weight_kg != null && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5 tabular-nums">
                            <Weight className="w-3 h-3 text-slate-400" strokeWidth={2} />
                            {c.weight_kg} кг
                          </span>
                        )}
                        {c.pallets != null && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5 tabular-nums">
                            <Layers className="w-3 h-3 text-slate-400" strokeWidth={2} />
                            {c.pallets} пал.
                          </span>
                        )}
                        {c.freight_amount != null && c.freight_amount > 0 && (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 ml-auto tabular-nums">
                            <Coins className="w-3.5 h-3.5" strokeWidth={2.2} />
                            {c.freight_amount} {currencySymbol}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Заметки */}
                    {c.notes && (
                      <div className="text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100 break-words">
                        {c.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Форма добавления/редактирования */}
      {isFormOpen && (
        <CargoForm
          tripId={tripId}
          cargoId={editingId || undefined}
          initialData={editingInitialData}
          clients={clients}
          loadingLocations={loadingLocations}
          unloadingLocations={unloadingLocations}
          customsLocations={customsLocations}
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
