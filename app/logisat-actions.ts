'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// ЭТО МЕСТО ДЛЯ ТВОИХ ДАННЫХ ИЗ ДОКУМЕНТАЦИИ LOGISAT
const LOGISAT_API_URL = 'https://api.logisat.com/v1/trips/'; 
const LOGISAT_API_KEY = process.env.LOGISAT_API_KEY; // Добавь этот ключ в Vercel Environment Variables

export async function fetchLogisatData(tripId: string) {
  console.log(`Запрашиваем данные Logisat для рейса ${tripId}`);
  
  try {
    // Вставь правильный эндпоинт из документации
    // Например: const response = await fetch(`${LOGISAT_API_URL}${tripId}`, {
    const response = await fetch(`${LOGISAT_API_URL}${tripId}`, {
      headers: {
        'Authorization': `Bearer ${LOGISAT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка API Logisat: ${response.status}`);
    }

    const data = await response.json();
    console.log('Данные получены:', data);

    // --- ЗАМЕНИ ЭТИ ПОЛЯ НА ТЕ, ЧТО В ТВОЕМ JSON ОТ LOGISAT ---
    // ВНИМАНИЕ: Ниже нужно вписать правильные названия полей из документации
    const km = data.distance || 0; 
    const liters = data.fuel_consumption || 0;
    const toll = data.toll_cost || 0; // e-TOLL если есть в API
    // -------------------------------------------------------------

    // Записываем в Supabase расходы (если km > 0)
    if (km > 0) {
      const { error: fuelError } = await supabase
        .from('trip_expenses')
        .insert({
          trip_id: tripId,
          category: 'fuel',
          amount_eur: liters * 1.5, // Пример: литры * цена за литр (замени на свою формулу)
          description: `Топливо (авто из Logisat)`,
          expense_date: new Date().toISOString().split('T')[0]
        });
      
      if (fuelError) console.error('Ошибка сохранения топлива:', fuelError);
    }

    if (toll > 0) {
      const { error: tollError } = await supabase
        .from('trip_expenses')
        .insert({
          trip_id: tripId,
          category: 'etoll',
          amount_eur: toll,
          description: `e-TOLL (авто из Logisat)`,
          expense_date: new Date().toISOString().split('T')[0]
        });
      if (tollError) console.error('Ошибка сохранения e-TOLL:', tollError);
    }

    // Обновляем страницу, чтобы показать новые цифры
    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: 'Данные Logisat загружены!' };

  } catch (error) {
    console.error('Ошибка интеграции Logisat:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
