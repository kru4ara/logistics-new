'use server';

import { cookies } from 'next/headers';
import { createClient } from '../../../lib/supabase-server';
import { fetchLogisatSummary, type SummaryResult } from '../../../lib/logisat';

export async function checkLogisat(
  deviceId: string,
  fromIso: string,
  toIso: string
): Promise<SummaryResult> {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'driver' && role !== 'admin') {
    return { success: false, stage: 'auth', error: 'Нет доступа' };
  }

  const supabase = await createClient();

  // Проверяем, что запрошенный deviceId принадлежит реальной машине с Logisat
  const { data: truck } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_device_id, logisat_enabled')
    .eq('logisat_device_id', deviceId)
    .eq('logisat_enabled', true)
    .single();

  if (!truck) {
    return { success: false, stage: 'truck_lookup', error: 'Машина с таким deviceId не найдена или не подключена к Logisat' };
  }

  return fetchLogisatSummary(deviceId, fromIso, toIso);
}
