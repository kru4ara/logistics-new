import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function GET() {
  try {
    // 1. Скачиваем курсы с бесплатного API (open.er-api.com)
    const response = await fetch('https://open.er-api.com/v6/latest/EUR');
    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('Не удалось получить курсы валют');
    }

    const plnRate = data.rates.PLN; // Сколько PLN за 1 EUR
    const bynRate = data.rates.BYN; // Сколько BYN за 1 EUR

    // Нам нужно: 1 PLN = X EUR
    const plnToEur = 1 / plnRate;
    const bynToEur = 1 / bynRate;

    // 2. Записываем в Supabase (дата сегодня)
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('rates')
      .upsert({
        rate_date: today,
        pln_to_eur: plnToEur,
        byn_to_eur: bynToEur
      }, { onConflict: 'rate_date' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
