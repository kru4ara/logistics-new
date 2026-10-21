'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GitMerge, X, Loader2, AlertTriangle } from 'lucide-react';
import { mergeContractors } from './actions';

type Option = { id: string; label: string };

export default function MergeContractorDialog({
  sourceId,
  sourceName,
  otherContractors,
  onClose,
}: {
  sourceId: string;
  sourceName: string;
  otherContractors: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!targetId) {
      setError('Выберите, к какому подрядчику присоединить');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await mergeContractors(sourceId, targetId);
      if (res.success) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-soft-lg max-w-md w-full p-5 md:p-6 space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            Объединить подрядчика
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-slate-600">
          Подрядчик <b>{sourceName}</b> будет объединён с выбранным. Все участки рейсов
          и заявки экспедирования перепривяжутся, а дубликат удалится.
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
          <span>Действие необратимо. Дубликат будет удалён.</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Присоединить к подрядчику
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="input"
          >
            <option value="">— Выберите подрядчика —</option>
            {otherContractors.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
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
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !targetId}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Объединение...
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                Объединить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
