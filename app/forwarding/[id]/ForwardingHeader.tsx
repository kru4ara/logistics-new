import Link from 'next/link';
import { Package, Pencil, Trash2, Receipt, ArrowLeft } from 'lucide-react';
import { deleteForwarding } from '../actions';

export default function ForwardingHeader({
  id,
  order,
}: {
  id: string;
  order: any;
}) {
  return (
    <>
      <Link
        href="/forwarding"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Все заявки
      </Link>

      <div className="card p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words flex items-center gap-2">
              <Package className="w-6 h-6 text-brand-600 shrink-0" />
              Заявка #{order.order_number || '—'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {order.load_date ? new Date(order.load_date).toLocaleDateString('ru-RU') : 'Дата не указана'}
            </p>
            {order.client_request_number && (
              <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Заявка клиента № <b className="text-slate-700">{order.client_request_number}</b>
                {order.client_request_date && (
                  <span className="text-slate-400 ml-2">
                    от {new Date(order.client_request_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 sm:shrink-0">
            <Link
              href={`/forwarding/${id}/edit`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-100 transition-all text-sm active:scale-[0.97]"
            >
              <Pencil className="w-4 h-4" />
              Редактировать
            </Link>
            <form action={deleteForwarding.bind(null, id)} className="flex-1 sm:flex-none">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                           hover:bg-red-500 hover:text-white transition-all text-sm font-medium active:scale-[0.97]"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
