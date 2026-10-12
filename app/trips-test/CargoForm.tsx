'use client';

import { useState, useTransition } from 'react';
import {
  Package,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { createCargo, updateCargo } from './cargo-actions';

type ClientOption = { id: string; label: string };

type CargoData = {
  id?: string;
  label: string;
  cargo_type: string;
  weight_kg: number | null;
  client_id: string | null;
  notes: string;
};

export default function CargoForm({
  tripId,
  cargoId,
  initialData,
  clients,
  defaultClientId,
  onClose,
  onSaved,
}: {
  tripId: string;
  cargoId?: string;
  initialData?: Partial<CargoData>;
  clients: ClientOption[];
  defaultClientId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(cargoId);

  const [label, setLabel] = useState(initialData?.label || '');
  const [cargoType, setCargoType] = useState(initialData?.cargo_type || '');
  const [weight, setWeight] = useState<string>(
    initialData?.weight_kg != null ? String(initialData.weight_kg) : ''
  );
  const [clientId, setClientId] = useState(
    initialData?.client_id || defaultClientId || ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError('Укажите название груза');
      return;
    }

    const formData = new FormData();
    formData.set('label', label.trim());
    formData.set('cargo_type', cargoType.trim());
    formData.set('weight_kg', weight);
    formData.set('client_id', clientId);
    formData.set('notes', notes.trim());

    startTransition(async () => {
      try {
        if (isEdit && cargoId) {
          await updateCargo(cargoId, tripId, formData);
        } else {
          await createCargo(tripId, formData);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message || 'Ошибка сохранения');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-soft-lg max-w-lg w-full my-8 p-5 md:p-6 space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            {isEdit ? 'Редактировать груз' : 'Добавить груз'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className={labelClass}>Название груза *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Caffarel, Италия / Паллеты 22 шт"
              required
              autoFocus
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1">
              Понятное описание — что везём, от кого или какой груз
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Тип груза</label>
              <input
                type="text"
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="pallets / металл / ..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Вес (кг)</label>
              <input
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="22000"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Клиент</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Не указан —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Опционально — если груз от конкретного клиента
            </p>
          </div>

          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Дополнительная информация"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
