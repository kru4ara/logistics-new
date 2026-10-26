import { Package, Thermometer } from 'lucide-react';

export default function ForwardingDetails({ order }: { order: any }) {
  const hasDetails =
    order.transport_type ||
    order.transport_temperature ||
    order.cargo_type ||
    order.cargo_quantity ||
    order.customs_loading ||
    order.customs_unloading;

  if (!hasDetails) return null;

  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-brand-600" />
        Детали перевозки
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {order.transport_type && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тип транспорта</div>
            <div className="text-slate-800 font-medium break-words">{order.transport_type}</div>
          </div>
        )}
        {order.transport_temperature && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Temperatura</div>
            <div className="text-slate-800 font-medium break-words inline-flex items-center gap-1.5">
              <Thermometer className="w-4 h-4" />
              {order.transport_temperature}
            </div>
          </div>
        )}
        {order.cargo_type && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тип груза</div>
            <div className="text-slate-800 font-medium break-words">{order.cargo_type}</div>
          </div>
        )}
        {order.cargo_quantity && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Количество</div>
            <div className="text-slate-800 font-medium break-words">{order.cargo_quantity}</div>
          </div>
        )}
        {order.customs_loading && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Таможня (загрузка)</div>
            <div className="text-slate-800 font-medium break-words">{order.customs_loading}</div>
          </div>
        )}
        {order.customs_unloading && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Таможня (выгрузка)</div>
            <div className="text-slate-800 font-medium break-words">{order.customs_unloading}</div>
          </div>
        )}
      </div>
    </div>
  );
}
