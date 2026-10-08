import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase-server';
import { sendCronAlert } from '../../../lib/cron-alert';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Защита: если CRON_SECRET задан — проверяем заголовок.
  // Vercel автоматически добавляет `Authorization: Bearer ${CRON_SECRET}` ко всем cron-запросам.
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = await createClient();

    // 1. Скачиваем курсы с бесплатного API (open.er-api.com)
    const response = await fetch('https://open.er-api.com/v6/latest/EUR', {
      cache: 'no-store',
    });
    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('Не удалось получить курсы валют');
    }

    const plnRate = data.rates.PLN; // Сколько PLN за 1 EUR
    const bynRate = data.rates.BYN; // Сколько BYN за 1 EUR

    if (!plnRate || !bynRate) {
      throw new Error(`API вернул неполные данные: PLN=${plnRate}, BYN=${bynRate}`);
    }

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

    return NextResponse.json({ success: true, date: today, pln_to_eur: plnToEur, byn_to_eur: bynToEur });
  } catch (error) {
    const msg = (error as Error).message || 'unknown error';
    await sendCronAlert('update-rates', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
