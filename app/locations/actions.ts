'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../../lib/audit';
import { requireCapability } from '../../lib/require-office';
import { getT } from '../../lib/i18n/server';

// ============================================================
// Парсинг формы
// ============================================================
function parseLocationForm(formData: FormData) {
  return {
    name: (formData.get('name') as string)?.trim() || '',
    type: (formData.get('type') as string) || 'both',
    country: (formData.get('country') as string)?.trim() || null,
    company_name: (formData.get('company_name') as string)?.trim() || null,
    postal_code: (formData.get('postal_code') as string)?.trim() || null,
    city: (formData.get('city') as string)?.trim() || null,
    address: (formData.get('address') as string)?.trim() || null,
    contact_person: (formData.get('contact_person') as string)?.trim() || null,
  };
}

const TRACKED_FIELDS = [
  'name', 'type', 'country', 'company_name',
  'postal_code', 'city', 'address', 'contact_person',
] as const;

// ============================================================
// СОЗДАНИЕ
// ============================================================
export async function createLocation(formData: FormData) {
  const { t } = await getT();
  // proxy.ts проверяет путь страницы, но экшен — отдельный эндпоинт:
  // проверяем право здесь же (см. lib/require-office.ts).
  await requireCapability('locations.edit');
  const supabase = await createClient();

  const data = parseLocationForm(formData);
  if (!data.name) throw new Error(t('dir.nameRequired'));

  const { data: created, error } = await supabase
    .from('locations')
    .insert([data])
    .select('id')
    .single();

  if (error) throw new Error(t('dir.addError', { msg: error.message }));

  if (created?.id) {
    await logAudit({
      entity_type: 'location',
      entity_id: created.id,
      action: 'create',
      summary: `Создана локация «${data.name}»${data.city ? ' · ' + data.city : ''}`,
    });
  }

  revalidatePath('/locations');
  redirect('/locations?toast=location_created');
}

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
export async function updateLocation(locationId: string, formData: FormData) {
  const { t } = await getT();
  // proxy.ts проверяет путь страницы, но экшен — отдельный эндпоинт:
  // проверяем право здесь же (см. lib/require-office.ts).
  await requireCapability('locations.edit');
  const supabase = await createClient();

  const data = parseLocationForm(formData);
  if (!data.name) throw new Error(t('dir.nameRequired'));

  const { data: before } = await supabase
    .from('locations')
    .select('name, type, country, company_name, postal_code, city, address, contact_person')
    .eq('id', locationId)
    .maybeSingle();

  const { error } = await supabase
    .from('locations')
    .update(data)
    .eq('id', locationId);

  if (error) throw new Error(t('dir.updateError', { msg: error.message }));

  if (before) {
    const changes = diffFields(
      before as Record<string, unknown>,
      data as Record<string, unknown>,
      [...TRACKED_FIELDS]
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'location',
        entity_id: locationId,
        action: 'update',
        summary: `Локация «${before.name}»: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath('/locations');
  redirect('/locations?toast=location_updated');
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteLocation(locationId: string) {
  const { t } = await getT();
  // proxy.ts проверяет путь страницы, но экшен — отдельный эндпоинт:
  // проверяем право здесь же (см. lib/require-office.ts).
  await requireCapability('locations.edit');
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('locations')
    .select('name, city')
    .eq('id', locationId)
    .maybeSingle();

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', locationId);

  if (error) throw new Error(t('dir.deleteError', { msg: error.message }));

  await logAudit({
    entity_type: 'location',
    entity_id: locationId,
    action: 'delete',
    summary: before
      ? `Удалена локация «${before.name}»${before.city ? ' · ' + before.city : ''}`
      : 'Удалена локация',
  });

  revalidatePath('/locations');
  redirect('/locations?toast=location_deleted');
}
