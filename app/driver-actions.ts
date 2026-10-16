'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { syncReminders } from './reminder-actions';
import { logAudit, diffFields } from '../lib/audit';

const TRACKED_FIELDS = [
  'first_name', 'last_name',
  'phone_by', 'phone_pl',
  'passport_series', 'passport_number', 'passport_issued_date', 'passport_issued_by', 'passport_expiry',
  'visa_expiry',
  'license_number', 'license_expiry',
  'tachograph_card_number', 'tachograph_card_expiry',
  'code_95_expiry', 'adr_expiry',
  'date_of_birth', 'address',
  'driver_card_last_download',
] as const;
 
export async function updateDriver(driverId: string, formData: FormData) {
  const supabase = await createClient();

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phoneBy = formData.get('phone_by') as string;
  const phonePl = formData.get('phone_pl') as string;
  const passportSeries = formData.get('passport_series') as string;
  const passportNumber = formData.get('passport_number') as string;
  const passportIssuedDate = formData.get('passport_issued_date') as string;
  const passportIssuedBy = formData.get('passport_issued_by') as string;
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
  // ⬅️ НОВОЕ
  const driverCardLastDownload = formData.get('driver_card_last_download') as string;

  // Берём старые значения для audit
  const { data: before } = await supabase
    .from('drivers')
    .select('first_name, last_name, phone_by, phone_pl, passport_series, passport_number, passport_issued_date, passport_issued_by, passport_expiry, visa_expiry, license_number, license_expiry, tachograph_card_number, tachograph_card_expiry, code_95_expiry, adr_expiry, date_of_birth, address, driver_card_last_download')
    .eq('id', driverId)
    .maybeSingle();

  const nextValues = {
    first_name: firstName,
    last_name: lastName,
    phone_by: phoneBy || null,
    phone_pl: phonePl || null,
    passport_series: passportSeries || null,
    passport_number: passportNumber || null,
    passport_issued_date: passportIssuedDate || null,
    passport_issued_by: passportIssuedBy || null,
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
    driver_card_last_download: driverCardLastDownload || null,
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

// ============================================================
// Замена фото паспорта водителя (удаляет старые, ставит новое)
// ============================================================
export async function replaceDriverPassport(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();

  const driverId = String(formData.get('driver_id') || '').trim();
  const file = formData.get('file') as File | null;

  if (!driverId) return { success: false, error: 'Не передан ID водителя' };
  if (!file || file.size === 0) return { success: false, error: 'Файл не выбран' };

  // 1. Найти старые passport-документы (картинки)
  const { data: oldDocs } = await supabase
    .from('documents')
    .select('id, file_path')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId)
    .eq('document_type', 'passport');

  // 2. Удалить старые из Storage + БД
  if (oldDocs && oldDocs.length > 0) {
    const paths = oldDocs.map((d) => d.file_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: removeErr } = await supabase.storage.from('documents').remove(paths);
      if (removeErr) {
        console.error('[replaceDriverPassport] storage remove failed:', removeErr.message);
      }
    }
    const { error: delErr } = await supabase
      .from('documents')
      .delete()
      .in('id', oldDocs.map((d) => d.id));
    if (delErr) {
      console.error('[replaceDriverPassport] db delete failed:', delErr.message);
    }
  }

  // 3. Загрузить новый файл
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `driver/${driverId}/passport-${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadErr) {
    return { success: false, error: `Ошибка загрузки: ${uploadErr.message}` };
  }

  // 4. Создать запись
  const { data: created, error: dbErr } = await supabase
    .from('documents')
    .insert({
      entity_type: 'driver',
      entity_id: driverId,
      document_type: 'passport',
      file_path: filePath,
      expiry_date: null,
    })
    .select('id')
    .single();

  if (dbErr) {
    await supabase.storage.from('documents').remove([filePath]);
    return { success: false, error: `Ошибка сохранения: ${dbErr.message}` };
  }

  // Audit
  if (created?.id) {
    await logAudit({
      entity_type: 'document',
      entity_id: created.id,
      action: 'create',
      summary: `Заменено фото паспорта водителя`,
    });
  }

  revalidatePath(`/drivers/${driverId}`);
  return { success: true };
}
