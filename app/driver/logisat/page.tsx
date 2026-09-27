import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import LogisatForm from './LogisatForm';

export const dynamic = 'force-dynamic';

export default async function DriverLogisatPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const supabase = await createClient();

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
          ← Мои рейсы
        </a>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">📡 Logisat</h1>
          <p className="text-slate-500 text-sm mt-1">
            Проверить расход топлива по машине за выбранный период.
          </p>
        </div>

        {trucks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Нет машин с Logisat</h2>
            <p className="text-slate-500 text-sm">
              Ни одна машина не подключена к Logisat. Обратитесь в офис.
            </p>
          </div>
        ) : (
          <LogisatForm trucks={trucks} />
        )}

      </div>
    </main>
  );
}
