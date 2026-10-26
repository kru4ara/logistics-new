import ForwardingStatusButtons from './ForwardingStatusButtons';

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершена',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачена',
};

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ForwardingStatusBlock({
  id,
  order,
}: {
  id: string;
  order: any;
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2">Статус</div>
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border
        ${statusColors[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {statusLabels[order.status] || order.status}
      </span>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <ForwardingStatusButtons orderId={id} currentStatus={order.status} />
      </div>
    </div>
  );
}
