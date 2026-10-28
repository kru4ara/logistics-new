import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/admin';
import ForwardingHeader from './ForwardingHeader';
import ForwardingStatusBlock from './ForwardingStatusBlock';
import ForwardingEconomics from './ForwardingEconomics';
import ForwardingClient from './ForwardingClient';
import ForwardingPoints from './ForwardingPoints';
import ForwardingContractors from './ForwardingContractors';
import ForwardingDetails from './ForwardingDetails';
import ForwardingExpenses from './ForwardingExpenses';

export const dynamic = 'force-dynamic';

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

export default async function ForwardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('forwarding_orders')
    .select('*, clients(name, contact_person, phone)')
    .eq('id', id)
    .single();

  if (error || !order) {
    return <div className="p-8 text-red-500">Заявка не найдена</div>;
  }

  const { data: expenses } = await supabase
    .from('forwarding_expenses')
    .select('*')
    .eq('forwarding_id', id)
    .order('expense_date', { ascending: false });

  const { data: contractorsList } = await supabase
    .from('forwarding_contractors')
    .select('*, contractors(name, phone)')
    .eq('forwarding_id', id)
    .order('position');

  const { data: pointsRaw } = await supabase
    .from('forwarding_points')
    .select('*, locations(name, city, country, company_name, postal_code, address, contact_person)')
    .eq('forwarding_id', id)
    .order('sequence');

  const loadingPoints = (pointsRaw || []).filter((p) => p.type === 'loading');
  const unloadingPoints = (pointsRaw || []).filter((p) => p.type === 'unloading');

  const clientPrice = order.client_price_eur || 0;
  const totalContractors = contractorsList?.reduce((sum, c) => sum + (c.price_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;

  const margin = clientPrice - totalContractors - totalExpenses;
  const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;

  const originalCurrency = order.original_currency || 'EUR';
  const showOriginal = originalCurrency !== 'EUR';

  const clientName = pickName(order.clients) || '—';
  const clientContact = pickField(order.clients, 'contact_person');
  const clientPhone = pickField(order.clients, 'phone');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <ForwardingHeader id={id} order={order} />

        <ForwardingStatusBlock id={id} order={order} />

        <ForwardingEconomics
          clientPrice={clientPrice}
          totalContractors={totalContractors}
          totalExpenses={totalExpenses}
          margin={margin}
          marginPct={marginPct}
          showOriginal={showOriginal}
          originalCurrency={originalCurrency}
          originalClientPrice={order.original_client_price || 0}
        />

        <ForwardingClient
          clientName={clientName}
          clientContact={clientContact}
          clientPhone={clientPhone}
        />

        <ForwardingPoints
          loadingPoints={loadingPoints}
          unloadingPoints={unloadingPoints}
        />

        <ForwardingContractors
          id={id}
          contractorsList={contractorsList}
          totalContractors={totalContractors}
        />

        <ForwardingDetails order={order} />

        <ForwardingExpenses
          id={id}
          expenses={expenses}
          totalExpenses={totalExpenses}
        />

        {/* Заметки */}
        {order.notes && (
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 text-brand-600">📝</span>
              Заметки
            </h2>
            <div className="text-slate-700 whitespace-pre-wrap break-words">{order.notes}</div>
          </div>
        )}

      </div>
    </main>
  );
}
