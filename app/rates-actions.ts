'use server';

import { supabase } from '../lib/supabaseClient';

export async function updateRates() {
  // Получаем курс PLN → EUR
  try {
    const plnResponse = await fetch('https://api.exchangerate.host/convert?from=PLN&to=EUR');
    const plnData = await plnResponse.json();
    const plnToEur = plnData.result;

    // Получаем курс BYN → EUR
    const bynResponse = await fetch('https://api.exchangerate.host/convert?from=BYN&to=EUR');
    const bynData = await bynResponse.json();
    const bynToEur = bynData.result;

    // Записываем в таблицу rates (сегодняшняя дата)
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('rates')
      .insert([
        {
          rate_date: today,
          pln_to_eur: plnToEur,
          byn_to_eur: bynToEur
        }
      ]);

    if (error) {
      console.error('Ошибка записывания курсов:', error);
    }
  } catch (error) {
    console.error('Ошибка получения курсов:', error);
  }
}
