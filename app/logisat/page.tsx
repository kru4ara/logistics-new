import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import LogisatTestForm from './LogisatTestForm';
import {
  Satellite,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Satellite className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Logisat
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Проверка данных из системы мониторинга. Раздел временный, для тестирования.
          </p>
        </div>

        {/* Инфо-плашка */}
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="text-sm text-brand-900">
              <b>Что это:</b> тестовый раздел для проверки интеграции с Logisat —
              онлайн-мониторинг транспорта. Позволяет выгрузить пробег и расход топлива
              по конкретной машине за период.
            </div>
          </div>
        </div>

        {/* Сводка по машинам */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">Подключено</span>
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-green-600 tabular-nums">
              {connectedTrucks.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Тягачей с устройством Logisat
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">Не подключено</span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-slate-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-700 tabular-nums">
              {notConnectedTrucks.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Тягачей без интеграции
            </div>
          </div>
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
