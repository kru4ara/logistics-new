'use server';

import { createClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/session';
import { can } from '../../../lib/roles';
import { fetchLogisatSummary, type SummaryResult } from '../../../lib/logisat';

export async function checkLogisat(
  deviceId: string,
  fromIso: string,
  toIso: string
): Promise<SummaryResult> {
  const { role } = await getSessionContext();
  // Было role !== 'driver' && role !== 'admin': роль из БД не нормализована,
  // и офис с ролью 'office' и менеджер получали «Нет доступа».
  if (!can(role, 'logisat.view')) {
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
