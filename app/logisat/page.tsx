import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import LogisatTestForm from './LogisatTestForm';

export const dynamic = 'force-dynamic';

export default async function LogisatPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('id, registration_number, type, logisat_device_id, logisat_enabled')
    .eq('type', 'tractor')
    .order('registration_number');

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const connectedTrucks = (trucks || []).filter(
    (t) => t.logisat_enabled && t.logisat_device_id
  );

  const notConnectedTrucks = (trucks || []).filter(
    (t) => !t.logisat_enabled || !t.logisat_device_id
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📡 Logisat — тестовый раздел</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Проверка данных из системы мониторинга. Раздел временный, для тестирования.
          </p>
        </div>

        <LogisatTestForm
          connectedTrucks={connectedTrucks.map((t) => ({
            id: t.id,
            registration: t.registration_number,
            deviceId: t.logisat_device_id!,
          }))}
          notConnectedTrucks={notConnectedTrucks.map((t) => ({
            id: t.id,
            registration: t.registration_number,
          }))}
        />

      </div>
    </main>
  );
}
