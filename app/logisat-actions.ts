'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const SERVER_URL = 'https://gps2.logisat.pl/atlas';
const USER_NAME = 'raibuilding';
const PASSWORD = 'Anatoli_123';

export async function fetchLogisatData(tripId: string) {
  console.log(`Запрос данных Logisat для рейса: ${tripId}`);
  
  try {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date, truck_id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) throw new Error('Рейс не найден в базе');
    if (!trip.end_date) throw new Error('У рейса нет даты завершения (end_date)');

    // Логисат ожидает время в микросекундах (умножаем на 1000!)
    const startTs = Math.floor(new Date(trip.start_date).getTime() * 1000);
    const endTs = Math.floor(new Date(trip.end_date).getTime() * 1000);

    const { data: truck, error: truckError } = await supabase
      .from('trucks')
      .select('device_id')
      .eq('id', trip.truck_id)
      .single();

    if (truckError || !truck || !truck.device_id) {
      throw new Error('Не найден device_id в таблице trucks');
    }

    const deviceId = truck.device_id;
    const url = `${SERVER_URL}/${USER_NAME}/historyextended/${deviceId}/${startTs}/${endTs}`;

    console.log(`Отправляем запрос: ${url}?password=***`);

    const fullUrl = `${url}?password=${PASSWORD}`;
    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error(`Ошибка API Логисат (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    console.log('Ответ получен. Проверяем структуру...');

    if (!data.positionList || data.positionList.length === 0) {
      throw new Error('Логисат вернул пустой список (positionList) за этот период');
    }

    const lastPoint = data.positionList[data.positionList.length - 1];
    const totalMeters = lastPoint.totaldistance || 0;
    const totalFuelMl = lastPoint.totalfuel || 0;

    const totalKm = Math.round(totalMeters / 1000);
    const totalLiters = Math.round(totalFuelMl / 1000);

    if (totalKm === 0 && totalLiters === 0) {
      throw new Error('Логисат вернул нулевые значения. Проверь период или device_id');
    }

    const fuelPricePerLiter = 1.5;
    const fuelCostEur = totalLiters * fuelPricePerLiter;

    if (totalLiters > 0) {
      await supabase.from('trip_expenses').insert({
        trip_id: tripId,
        category: 'fuel',
        amount_eur: fuelCostEur,
        description: `Топливо (Logisat: ${totalLiters} л)`,
        expense_date: new Date().toISOString().split('T')[0]
      });
    }

    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: `Загружено: ${totalKm} км, ${totalLiters} л (${fuelCostEur.toFixed(2)} €)` };

  } catch (error) {
    console.error('Ошибка:', error);
    // Теперь ошибка покажется пользователю на сайте!
    throw new Error(`Ошибка интеграции: ${(error as Error).message}`);
  }
}
