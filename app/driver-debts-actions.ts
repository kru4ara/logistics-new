'use server';

import { createClient } from '../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logAudit } from '../lib/audit';

// ============================================================
// Конвертация в EUR по курсу на дату (та же логика, что в trip-actions)
// ============================================================
async function toEur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  amount: number,
  currency: string,
  date: string
): Promise<number> {
  if (currency === 'EUR' || !currency) return amount;
  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.pln_to_eur ?? 0.23);
  }
  if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.byn_to_eur ?? 0.30);
  }
  return amount;
}

// ============================================================
// Баланс водителя
// ============================================================
export async function getDriverBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driverId: string
): Promise<{ accrued: number; paidOut: number; balance: number }> {
  const { data } = await supabase
    .from('driver_transactions')
    .select('type, amount_eur')
    .eq('driver_id', driverId);

  let accrued = 0;
  let paidOut = 0;

  for (const t of data || []) {
    if (t.type === 'accrual') accrued += Number(t.amount_eur) || 0;
    else if (t.type === 'payout') paidOut += Number(t.amount_eur) || 0;
  }

  return {
    accrued,
    paidOut,
    balance: accrued - paidOut,
  };
}

// ============================================================
// Начислить долг водителю (компания должна ему)
// ============================================================
export async function accrueDriverDebt(formData: FormData) {
  const supabase = await createClient();

  const driverId = formData.get('driver_id') as string;
  const tripId = (formData.get('trip_id') as string) || null;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0];
  const notes = (formData.get('notes') as string) || null;

  if (!driverId) throw new Error('Не указан водитель');
  if (originalAmount <= 0) throw new Error('Сумма должна быть больше нуля');

  const amountEur = await toEur(supabase, originalAmount, currency, date);

  const { data: created, error } = await supabase
    .from('driver_transactions')
    .insert([
      {
        driver_id: driverId,
        trip_id: tripId,
        expense_id: null,
        type: 'accrual',
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency,
        date,
        notes,
      },
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка начисления: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'driver_transaction',
      entity_id: created.id,
      action: 'create',
      summary: `Начислен долг водителю: ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)${notes ? ' · ' + notes : ''}`,
    });
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
}

// ============================================================
// Погасить долг (выплатить водителю)
// ============================================================
export async function payOutDriverDebt(formData: FormData) {
  const supabase = await createClient();

  const driverId = formData.get('driver_id') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0];
  const notes = (formData.get('notes') as string) || null;

  if (!driverId) throw new Error('Не указан водитель');
  if (originalAmount <= 0) throw new Error('Сумма должна быть больше нуля');

  const amountEur = await toEur(supabase, originalAmount, currency, date);

  const { data: created, error } = await supabase
    .from('driver_transactions')
    .insert([
      {
        driver_id: driverId,
        trip_id: null,
        expense_id: null,
        type: 'payout',
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency,
        date,
        notes,
      },
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка выплаты: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'driver_transaction',
      entity_id: created.id,
      action: 'create',
      summary: `Выплачено водителю: ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)${notes ? ' · ' + notes : ''}`,
    });
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
}

// ============================================================
// Удалить операцию (если ошиблись)
// ============================================================
export async function deleteDriverTransaction(id: string, driverId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('driver_transactions')
    .select('type, amount_eur, original_amount, currency, notes')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('driver_transactions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'driver_transaction',
    entity_id: id,
    action: 'delete',
    summary: before
      ? `Удалена операция: ${before.type === 'accrual' ? 'начисление' : 'выплата'} ${before.original_amount} ${before.currency}`
      : 'Удалена операция',
  });

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
}
