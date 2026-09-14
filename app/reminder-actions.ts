'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

/**
 * Синхронизация напоминаний для сущности (водителя или машины).
 * Удаляет старые напоминания и создаёт новые из дат в карточке.
 */
export async function syncReminders(
  entityType: 'driver' | 'truck',
  entityId: string
) {
  // 1. Удаляем старые напоминания для этой сущности
  await supabase
    .from('reminders')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (entityType === 'driver') {
    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', entityId)
      .single();

    if (!driver) return;

    const name = `${driver.first_name} ${driver.last_name}`;

    const docs = [
      { title: `📕 Паспорт: ${name}`, date: driver.passport_expiry, category: 'driver_doc' },
      { title: `🛂 Виза: ${name}`, date: driver.visa_expiry, category: 'driver_doc' },
      { title: `🚗 Права: ${name}`, date: driver.license_expiry, category: 'driver_doc' },
      { title: `💳 Карта тахографа: ${name}`, date: driver.tachograph_card_expiry, category: 'driver_doc' },
      { title: `📜 Код 95: ${name}`, date: driver.code_95_expiry, category: 'driver_doc' },
      { title: `⚠️ АДР: ${name}`, date: driver.adr_expiry, category: 'driver_doc' },
    ];

    for (const doc of docs) {
      if (!doc.date) continue;
      await supabase.from('reminders').insert([
        {
          title: doc.title,
          category: doc.category,
          due_date: doc.date,
          entity_type: 'driver',
          entity_id: entityId,
          status: 'active',
        },
      ]);
    }
  }

  if (entityType === 'truck') {
    const { data: truck } = await supabase
      .from('trucks')
      .select('*')
      .eq('id', entityId)
      .single();

    if (!truck) return;

    const docs = [
      { title: `🛡 Страховка ОС: ${truck.registration_number}`, date: truck.truck_insurance_expiry, category: 'insurance' },
      { title: `🔧 Техосмотр: ${truck.registration_number}`, date: truck.tech_inspection_expiry, category: 'inspection' },
      { title: `🛂 Пограничная страховка РБ: ${truck.registration_number}`, date: truck.border_insurance_expiry, category: 'insurance' },
      { title: `💳 Легализация тахографа: ${truck.registration_number}`, date: truck.tachograph_legalization_expiry, category: 'inspection' },
    ];

    for (const doc of docs) {
      if (!doc.date) continue;
      await supabase.from('reminders').insert([
        {
          title: doc.title,
          category: doc.category,
          due_date: doc.date,
          entity_type: 'truck',
          entity_id: entityId,
          status: 'active',
        },
      ]);
    }
  }

  revalidatePath('/reminders');
}
