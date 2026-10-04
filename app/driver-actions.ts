'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { syncReminders } from './reminder-actions';
import { logAudit, diffFields } from '../lib/audit';

const TRACKED_FIELDS = [
  'first_name', 'last_name', 'phone',
  'passport_number', 'passport_expiry', 'visa_expiry',
  'license_number', 'license_expiry',
  'tachograph_card_number', 'tachograph_card_expiry',
  'code_95_expiry', 'adr_expiry',
  'date_of_birth', 'address',
] as const;

export async function updateDriver(driverId: string, formData: FormData) {
  const supabase = await createClient();

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phone = formData.get('phone') as string;
  const passportNumber = formData.get('passport_number') as string;
  const passportExpiry = formData.get('passport_expiry') as string;
  const visaExpiry = formData.get('visa_expiry') as string;
  const licenseNumber = formData.get('license_number') as string;
  const licenseExpiry = formData.get('license_expiry') as string;
  const tachographCardNumber = formData.get('tachograph_card_number') as string;
  const tachographCardExpiry = formData.get('tachograph_card_expiry') as string;
  const code95Expiry = formData.get('code_95_expiry') as string;
  const adrExpiry = formData.get('adr_expiry') as string;
  const dateOfBirth = formData.get('date_of_birth') as string;
  const address = formData.get('address') as string;

  // Берём старые значения для audit
  const { data: before } = await supabase
    .from('drivers')
    .select('first_name, last_name, phone, passport_number, passport_expiry, visa_expiry, license_number, license_expiry, tachograph_card_number, tachograph_card_expiry, code_95_expiry, adr_expiry, date_of_birth, address')
    .eq('id', driverId)
    .maybeSingle();

  const nextValues = {
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    passport_number: passportNumber || null,
    passport_expiry: passportExpiry || null,
    visa_expiry: visaExpiry || null,
    license_number: licenseNumber || null,
    license_expiry: licenseExpiry || null,
    tachograph_card_number: tachographCardNumber || null,
    tachograph_card_expiry: tachographCardExpiry || null,
    code_95_expiry: code95Expiry || null,
    adr_expiry: adrExpiry || null,
    date_of_birth: dateOfBirth || null,
    address: address || null,
  };

  const { error } = await supabase
    .from('drivers')
    .update(nextValues)
    .eq('id', driverId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // Обновляем напоминания
  await syncReminders('driver', driverId);

  // Audit
  if (before) {
    const changes = diffFields(
      before as Record<string, unknown>,
      nextValues as Record<string, unknown>,
      [...TRACKED_FIELDS]
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      const fullName = `${before.first_name || ''} ${before.last_name || ''}`.trim() || '—';
      await logAudit({
        entity_type: 'driver',
        entity_id: driverId,
        action: 'update',
        summary: `Водитель «${fullName}»: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/reminders');
  redirect(`/drivers/${driverId}`);
}
