'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { requireCapability } from '../../lib/require-office';
import { getSessionContext } from '../../lib/session';
import { logAudit } from '../../lib/audit';
import { parseCompanyForm } from '../../lib/company-rules';
import { STAMP_PATH } from '../../lib/company';

const COMPANY_AUDIT_ID = '00000000-0000-0000-0000-000000000001';
const MAX_STAMP_BYTES = 2 * 1024 * 1024;

function back(params: Record<string, string>): never {
  redirect(`/settings?${new URLSearchParams(params).toString()}`);
}

/** Сохранить реквизиты и (если выбран файл) печать для заявок. */
export async function saveCompanySettings(formData: FormData) {
  await requireCapability('settings.edit');

  const parsed = parseCompanyForm((k) => {
    const v = formData.get(k);
    return typeof v === 'string' ? v : null;
  });
  if (!parsed.ok) back({ error: parsed.error });

  const admin = await createClient();
  const { userId } = await getSessionContext();

  const { error } = await admin
    .from('company_settings')
    .upsert({ id: 1, ...parsed.row, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) back({ error: `Не удалось сохранить: ${error.message}` });

  // Печать: только PNG — так её вставляет генератор заявки.
  const stamp = formData.get('stamp');
  let stampUpdated = false;
  if (stamp instanceof File && stamp.size > 0) {
    if (stamp.type !== 'image/png') back({ error: 'Печать — только PNG (лучше с прозрачным фоном)' });
    if (stamp.size > MAX_STAMP_BYTES) back({ error: 'Печать — не больше 2 МБ' });
    const { error: upErr } = await admin.storage
      .from('documents')
      .upload(STAMP_PATH, Buffer.from(await stamp.arrayBuffer()), { contentType: 'image/png', upsert: true });
    if (upErr) back({ error: `Реквизиты сохранены, печать — нет: ${upErr.message}` });
    stampUpdated = true;
  }

  await logAudit({
    entity_type: 'company',
    entity_id: COMPANY_AUDIT_ID,
    action: 'update',
    summary: `Изменены настройки компании «${parsed.row.name}»${stampUpdated ? ', загружена печать' : ''}`,
  });

  revalidatePath('/settings');
  revalidatePath('/login');
  back({ saved: '1' });
}
