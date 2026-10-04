'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../../lib/audit';

const TRACKED_FIELDS = [
  'name', 'full_name', 'country', 'address', 'tax_id',
  'contact_person', 'phone', 'email', 'notes',
] as const;

export async function createContractor(formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const country = (formData.get('country') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const taxId = (formData.get('tax_id') as string)?.trim() || null;
  const contactPerson = (formData.get('contact_person') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Название обязательно');

  const { data: created, error } = await supabase
    .from('contractors')
    .insert([{
      name,
      full_name: fullName,
      country,
      address,
      tax_id: taxId,
      contact_person: contactPerson,
      phone,
      email,
      notes,
    }])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка создания: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'contractor',
      entity_id: created.id,
      action: 'create',
      summary: `Создан подрядчик «${name}»${country ? ' · ' + country : ''}`,
    });
  }

  revalidatePath('/contractors');
  redirect('/contractors?toast=contractor_created');
}

export async function updateContractor(contractorId: string, formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const country = (formData.get('country') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const taxId = (formData.get('tax_id') as string)?.trim() || null;
  const contactPerson = (formData.get('contact_person') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Название обязательно');

  const { data: before } = await supabase
    .from('contractors')
    .select('name, full_name, country, address, tax_id, contact_person, phone, email, notes')
    .eq('id', contractorId)
    .maybeSingle();

  const { error } = await supabase
    .from('contractors')
    .update({
      name,
      full_name: fullName,
      country,
      address,
      tax_id: taxId,
      contact_person: contactPerson,
      phone,
      email,
      notes,
    })
    .eq('id', contractorId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  if (before) {
    const changes = diffFields(
      before as Record<string, unknown>,
      {
        name,
        full_name: fullName,
        country,
        address,
        tax_id: taxId,
        contact_person: contactPerson,
        phone,
        email,
        notes,
      } as Record<string, unknown>,
      [...TRACKED_FIELDS]
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'contractor',
        entity_id: contractorId,
        action: 'update',
        summary: `Подрядчик «${before.name}»: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath('/contractors');
  redirect('/contractors?toast=contractor_updated');
}

export async function deleteContractor(contractorId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('contractors')
    .select('name, country')
    .eq('id', contractorId)
    .maybeSingle();

  const { error } = await supabase
    .from('contractors')
    .delete()
    .eq('id', contractorId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'contractor',
    entity_id: contractorId,
    action: 'delete',
    summary: before
      ? `Удалён подрядчик «${before.name}»${before.country ? ' · ' + before.country : ''}`
      : 'Удалён подрядчик',
  });

  revalidatePath('/contractors');
  redirect('/contractors?toast=contractor_deleted');
}
