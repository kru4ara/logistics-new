'use client';

import { useTransition } from 'react';
import {
  ClipboardList,
  Truck,
  CheckCircle2,
  FileText,
  Banknote,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { setForwardingStatus } from '../actions';

type StatusItem = {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
};

const allStatuses: StatusItem[] = [
  { value: 'planned',   label: 'Планируется',    Icon: ClipboardList, color: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
  { value: 'active',    label: 'В пути',         Icon: Truck,         color: 'bg-brand-50 hover:bg-brand-100 text-brand-700' },
  { value: 'completed', label: 'Завершена',      Icon: CheckCircle2,  color: 'bg-green-100 hover:bg-green-200 text-green-700' },
  { value: 'invoiced',  label: 'Выставлен счёт', Icon: FileText,      color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700' },
  { value: 'paid',      label: 'Оплачена',       Icon: Banknote,      color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' },
];

export default function ForwardingStatusButtons({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(status: string) {
    if (status === currentStatus || isPending) return;
    startTransition(async () => {
      await setForwardingStatus(orderId, status);
    });
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2">
        Изменить статус
      </div>
      <div className="flex flex-wrap gap-2">
        {allStatuses.map(({ value, label, Icon, color }) => {
          const isActive = value === currentStatus;
          return (
            <button
              key={value}
              type="button"
              disabled={isPending}
              onClick={() => handleClick(value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-brand-600 text-white shadow-brand ring-2 ring-brand-300'
                  : color}
                ${isPending ? 'opacity-50 cursor-wait' : 'active:scale-[0.97]'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {isActive && <Check className="w-3 h-3 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
