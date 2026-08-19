'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// ТВОИ РЕАЛЬНЫЕ ДАННЫЕ
const SERVER_URL = 'https://gps2.logisat.pl/atlas';
const USER_NAME = 'raibuilding';
const PASSWORD = 'Anatoli_123';

export async function fetchLogisatData(tripId: string) {
  console.log(`Запрос данных Logisat для рейса: ${tripId}`);
  
  try {
    // 1. Получаем данные рейса из Supabase
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date, truck_id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error('Рейс не найден в базе');
    }

    const startTs = Math.floor(new Date(trip.start_date).getTime() / 1000);
    const endTs = trip.end_date 
      ? Math.floor(new Date(trip.end_date).getTime() / 1000) 
      : Math.floor(Date.now() / 1000);

    // 2. Получаем device_id из таблицы trucks
    const { data: truck, error: truckError } = await supabase
      .from('trucks')
      .select('device_id')
      .eq('id', trip.truck_id)
      .single();

    if (truckError || !truck || !truck.device_id) {
      throw new Error('Не найден device_id для этого грузовика. Добавь его в таблицу trucks.');
    }

    const deviceId = truck.device_id;

    // 3. Формируем URL для historyextended (метод из документации)
    const url = `${SERVER_URL}/${USER_NAME}/historyextended/${deviceId}/${startTs}/${endTs}`;

    console.log(`Отправляем запрос: ${url}`);

    // 4. Выполняем запрос с паролем в параметрах (GET, как в примере)
    // Так как в примере используется GET с ?password=, мы добавляем его в URL
    const fullUrl = `${url}?password=${PASSWORD}`;

    const response = await fetch(fullUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API Logisat (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    console.log('Ответ от Logisat получен');

    // 5. Проверяем структуру ответа
    if (!data.positionList || !Array.isArray(data.positionList) || data.positionList.length === 0) {
      return { success: false, message: 'Нет данных по этому маршруту за выбранный период.' };
    }

    // 6. Берем последнюю точку (самую свежую) для получения итоговых данных
    const lastPoint = data.positionList[data.positionList.length - 1];

    // Поля из документации:
    // "totaldistance" - общий пробег в метрах
    // "totalfuel" - общий расход топлива в миллилитрах
    // "mileagegps" - пробег по GPS в метрах (альтернатива)
    
    const totalMeters = lastPoint.totaldistance || 0;
    const totalFuelMl = lastPoint.totalfuel || 0;
    
    const totalKm = Math.round(totalMeters / 1000);
    const totalLiters = Math.round(totalFuelMl / 1000);

    console.log(`Найдено: ${totalKm} км, ${totalLiters} л топлива`);

    // 7. Записываем расходы в Supabase
    // Цена топлива (в евро) — замени на актуальную!
    const fuelPricePerLiter = 1.5; 
    const fuelCostEur = totalLiters * fuelPricePerLiter;

    if (totalLiters > 0) {
      const { error: fuelError } = await supabase
        .from('trip_expenses')
        .insert({
          trip_id: tripId,
          category: 'fuel',
          amount_eur: fuelCostEur,
          description: `Топливо (Logisat: ${totalLiters} л)`,
          expense_date: new Date().toISOString().split('T')[0]
        });
      
      if (fuelError) {
        console.error('Ошибка сохранения топлива:', fuelError);
      }
    }

    revalidatePath(`/trips/${tripId}`);
    
    return { 
      success: true, 
      message: `Загружено: ${totalKm} км, ${totalLiters} л топлива (${fuelCostEur.toFixed(2)} €)` 
    };

  } catch (error) {
    console.error('Ошибка интеграции Logisat:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
