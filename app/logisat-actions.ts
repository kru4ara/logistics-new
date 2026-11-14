'use server';

import { requireOffice } from '../lib/require-office';
import { revalidatePath } from 'next/cache';
import { getT } from '../lib/i18n/server';

export async function fetchLogisatData(tripId: string) {
  const { t } = await getT();
  await requireOffice();
  console.log('Режим отладки. Данные не подтягиваются.');
  
  // Возвращаем фейковые данные для проверки
  const fakeKm = 425;
  const fakeLiters = 145;
  const fakeCost = 217.5;

  revalidatePath(`/trips/${tripId}`);
  
  return { 
    success: true, 
    message: t('lgs.debug', { km: fakeKm, l: fakeLiters, cost: fakeCost.toFixed(2) }) 
  };
}
