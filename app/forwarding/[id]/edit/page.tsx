import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import EditForwardingForm from './EditForwardingForm';

export const dynamic = 'force-dynamic';

export default async function EditForwardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('forwarding_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !order) {
    return <div className="p-8 text-red-500">Заявка не найдена</div>;
  }

  const { data: clients } = await supabase.from('clients').select('id, name').order('name');
  const { data: contractors } = await supabase.from('contractors').select('id, name').order('name');

  const { data: loadingLocations } = await supabase
    .from('locations')
    .select('id, name, city, country')
    .in('type', ['loading', 'both'])
    .order('name');

  const { data: unloadingLocations } = await supabase
    .from('locations')
    .select('id, name, city, country')
    .in('type', ['unloading', 'both'])
    .order('name');

  const { data: initialContractors } = await supabase
    .from('forwarding_contractors')
    .select('*')
    .eq('forwarding_id', id)
    .order('position');

  const { data: initialPoints } = await supabase
    .from('forwarding_points')
    .select('*')
    .eq('forwarding_id', id)
    .order('sequence');

  const formatLocLabel = (l: any) => {
    const parts = [l.name];
    if (l.city) parts.push(l.city);
    if (l.country) parts.push(l.country);
    return parts.join(' · ');
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href={`/forwarding/${id}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к заявке
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            ✏️ Редактировать заявку #{order.order_number || '—'}
          </h1>
        </div>

        <EditForwardingForm
          order={order}
          orderId={id}
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          contractors={(contractors || []).map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={(loadingLocations || []).map((l) => ({ id: l.id, label: formatLocLabel(l) }))}
          unloadingLocations={(unloadingLocations || []).map((l) => ({ id: l.id, label: formatLocLabel(l) }))}
          initialContractors={(initialContractors || []).map((c) => ({
            contractor_id: c.contractor_id,
            original_price: c.original_price,
            currency: c.currency,
            truck_number: c.truck_number,
            driver_name: c.driver_name,
            payment_days: c.payment_days,
            notes: c.notes,
          }))}
          initialPoints={(initialPoints || []).map((p) => ({
            id: p.id,
            type: p.type as 'loading' | 'unloading',
            sequence: p.sequence,
            location_id: p.location_id,
            date: p.date,
            loading_number: p.loading_number,
            notes: p.notes,
          }))}
        />

      </div>
    </main>
  );
}
