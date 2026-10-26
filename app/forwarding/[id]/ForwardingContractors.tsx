import Link from 'next/link';
import { Truck, Coins, User, Phone, StickyNote } from 'lucide-react';
import ContractorDocxButton from './ContractorDocxButton';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickField(rel: unknown, field: string): string | undefined {
  if (!rel) return undefined;
  const obj = Array.isArray(rel) ? rel[0] : rel;
  if (typeof obj === 'object' && obj !== null && field in obj) {
    return (obj as Record<string, string | undefined>)[field];
  }
  return undefined;
}

export default function ForwardingContractors({
  id,
  contractorsList,
  totalContractors,
}: {
  id: string;
  contractorsList: any[] | null;
  totalContractors: number;
}) {
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Truck className="w-5 h-5 text-brand-600" />
        Подрядчики
        {contractorsList && contractorsList.length > 0 && (
          <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
            {contractorsList.length}
          </span>
        )}
      </h2>

      {(!contractorsList || contractorsList.length === 0) ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          Подрядчики не указаны.{' '}
          <Link href={`/forwarding/${id}/edit`} className="text-brand-600 hover:underline">
            Добавить
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {contractorsList.map((c, idx) => {
            const cName = pickName(c.contractors) || '—';
            const cPhone = pickField(c.contractors, 'phone');
            const showOrig = (c.currency || 'EUR') !== 'EUR';

            return (
              <div key={c.id} className="border-l-4 border-red-500 pl-4 py-2">
                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <div className="font-bold text-slate-900 break-words">{cName}</div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className="text-red-500 font-semibold">
                    {c.price_eur?.toFixed(2)} €
                  </div>
                  {showOrig && (
                    <div className="text-xs text-slate-400">
                      ({c.original_price?.toFixed(2)} {c.currency})
                    </div>
                  )}
                  {cPhone && (
                    <a href={`tel:${cPhone}`} className="text-slate-600 hover:text-brand-600 text-xs inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {cPhone}
                    </a>
                  )}
                </div>

                {(c.truck_number || c.driver_name || c.payment_days) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                    {c.truck_number && <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /><b>{c.truck_number}</b></span>}
                    {c.driver_name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{c.driver_name}</span>}
                    {c.payment_days && <span className="inline-flex items-center gap-1"><Coins className="w-3 h-3" />{c.payment_days} дн.</span>}
                  </div>
                )}

                {c.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 break-words">
                    <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{c.notes}</span>
                  </div>
                )}

                <div className="mt-3">
                  <ContractorDocxButton
                    forwardingId={id}
                    contractorId={c.id}
                    contractorName={cName}
                  />
                </div>
              </div>
            );
          })}

          {contractorsList.length > 1 && (
            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Итого подрядчикам</span>
              <span className="text-lg font-bold text-red-500">{totalContractors.toFixed(2)} €</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
