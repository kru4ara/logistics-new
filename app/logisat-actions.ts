'use server';

import { revalidatePath } from 'next/cache';

export async function fetchLogisatData(tripId: string) {
  console.log('Режим отладки. Данные не подтягиваются.');
  
  // Возвращаем фейковые данные для проверки
  const fakeKm = 425;
  const fakeLiters = 145;
  const fakeCost = 217.5;

  revalidatePath(`/trips/${tripId}`);
  
  return { 
    success: true, 
    message: `Режим отладки: ${fakeKm} км, ${fakeLiters} л (${fakeCost.toFixed(2)} €)` 
  };
}
