import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../lib/session';
import { createClient as createAuthClient } from '../../../lib/supabase/server';
import LogisatForm from './LogisatForm';
import { isDriverRole } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { RadioTower, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DriverLogisatPage() {
  const { t: tr } = await getT();
  const { role, driverId } = await getSessionContext();

  if (!isDriverRole(role) || !driverId) {
    redirect('/login');
  }

  // RLS-клиент вместо service_role: выборка ограничивается политиками
  // RLS, поэтому водитель видит только свои данные.
  const supabase = await createAuthClient();

  const { data: tractors } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_device_id, logisat_enabled')
    .eq('type', 'tractor')
    .eq('logisat_enabled', true)
    .not('logisat_device_id', 'is', null)
    .order('registration_number');

  const trucks = (tractors || [])
    .filter((t) => !!t.logisat_device_id)
    .map((t) => ({
      id: t.id,
      label: t.registration_number,
      deviceId: t.logisat_device_id as string,
    }));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          {tr('drvApp.myTrips')}
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><RadioTower className="w-6 h-6 text-brand-600" aria-hidden="true" />GPS</h1>
          <p className="text-slate-500 text-sm mt-1">
            {tr('drvApp.lsPageHint')}
          </p>
        </div>

        {trucks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">{tr('drvApp.noLsTrucks')}</h2>
            <p className="text-slate-500 text-sm">
              {tr('drvApp.noLsTrucksHint')}
            </p>
          </div>
        ) : (
          <LogisatForm trucks={trucks} />
        )}

      </div>
    </main>
  );
}
