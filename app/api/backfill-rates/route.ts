import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase-server';

// Получить PLN → EUR на конкретную дату (frankfurter.app — данные ЕЦБ)
async function fetchPlnToEur(date: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=PLN&to=EUR`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.EUR;
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

// Получить BYN → EUR на конкретную дату (api.nbrb.by — Нацбанк РБ)
async function fetchBynToEur(date: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.nbrb.by/exrates/rates/EUR?parammode=2&ondate=${date}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Cur_OfficialRate = сколько BYN стоит 1 EUR
    // Нам нужно: сколько EUR стоит 1 BYN → 1 / Cur_OfficialRate
    const officialRate = data?.Cur_OfficialRate;
    if (typeof officialRate === 'number' && officialRate > 0) {
      return 1 / officialRate;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Собираем все уникальные даты из расходов
    const dates = new Set<string>();

    const { data: e1 } = await supabase
      .from('trip_expenses')
      .select('expense_date')
      .in('currency', ['PLN', 'BYN'])
      .not('expense_date', 'is', null);
    e1?.forEach((r) => r.expense_date && dates.add(r.expense_date));

    const { data: e2 } = await supabase
      .from('fixed_costs')
      .select('expense_date')
      .in('currency', ['PLN', 'BYN'])
      .not('expense_date', 'is', null);
    e2?.forEach((r) => r.expense_date && dates.add(r.expense_date));

    const { data: e3 } = await supabase
      .from('forwarding_orders')
      .select('load_date')
      .in('original_currency', ['PLN', 'BYN'])
      .not('load_date', 'is', null);
    e3?.forEach((r) => r.load_date && dates.add(r.load_date));

    const sortedDates = Array.from(dates).sort();

    // 2. Для каждой даты запрашиваем курсы
    const results: Array<{
      rate_date: string;
      pln_to_eur: number | null;
      byn_to_eur: number | null;
    }> = [];

    let plnFound = 0;
    let bynFound = 0;
    let plnFailed = 0;
    let bynFailed = 0;

    for (const d of sortedDates) {
      const [pln, byn] = await Promise.all([
        fetchPlnToEur(d),
        fetchBynToEur(d),
      ]);

      if (pln !== null) plnFound++; else plnFailed++;
      if (byn !== null) bynFound++; else bynFailed++;

      results.push({
        rate_date: d,
        pln_to_eur: pln,
        byn_to_eur: byn,
      });

      // Пауза 100мс между датами, чтобы не спамить API
      await new Promise((r) => setTimeout(r, 100));
    }

    // 3. Upsert в rates (только те, где хотя бы один курс получен)
    const toWrite = results.filter((r) => r.pln_to_eur !== null || r.byn_to_eur !== null);

    if (toWrite.length > 0) {
      const { error } = await supabase
        .from('rates')
        .upsert(toWrite, { onConflict: 'rate_date' });

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message, processed: results.length },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      totalDates: sortedDates.length,
      written: toWrite.length,
      pln: { found: plnFound, failed: plnFailed },
      byn: { found: bynFound, failed: bynFailed },
      firstDate: sortedDates[0] || null,
      lastDate: sortedDates[sortedDates.length - 1] || null,
      // Примеры для проверки
      sample: results.slice(0, 5),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
