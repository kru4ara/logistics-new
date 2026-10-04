'use server';

import { createClient } from '../lib/supabase-server';
import { logAudit, type AuditEntityType } from '../lib/audit';

export type UploadResult = { success: true } | { success: false; error: string };

const ENTITY_LABELS: Record<string, string> = {
  driver: 'водителя',
  truck: 'машины',
  trip: 'рейса',
  forwarding: 'заявки',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  passport: 'Паспорт',
  visa: 'Виза',
  license: 'Водительское удостоверение',
  tachograph_card: 'Карта водителя',
  code95: 'Код 95',
  adr: 'АДР',
  insurance: 'Страховка',
  tech_passport: 'Техпаспорт',
  border_insurance: 'Пограничная страховка',
  tachograph_legalization: 'Легализация тахографа',
  cmr: 'CMR',
  other: 'Другое',
};

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const entityType = String(formData.get('entityType') || '').trim();
  const entityId = String(formData.get('entityId') || '').trim();
  const documentType = String(formData.get('documentType') || '').trim();
  const expiryDate = String(formData.get('expiryDate') || '').trim();
  const file = formData.get('file') as File | null;

  if (!entityType || !entityId || !documentType) {
    return { success: false, error: 'Не все поля заполнены' };
  }
  if (!file || file.size === 0) {
    return { success: false, error: 'Файл не выбран' };
  }

  const supabase = await createClient();

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `${entityType}/${entityId}/${documentType}-${Date.now()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Ошибка загрузки: ${uploadError.message}` };
  }

  const { data: created, error: dbError } = await supabase
    .from('documents')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      document_type: documentType,
      file_path: filePath,
      expiry_date: expiryDate || null,
    })
    .select('id')
    .single();

  if (dbError) {
    // файл уже загружен, но запись не создалась — почистим за собой
    await supabase.storage.from('documents').remove([filePath]);
    return { success: false, error: `Ошибка сохранения: ${dbError.message}` };
  }

  // Audit
  if (created?.id) {
    const entityLabel = ENTITY_LABELS[entityType] || entityType;
    const docLabel = DOC_TYPE_LABELS[documentType] || documentType;
    const expiryPart = expiryDate
      ? ` · срок ${new Date(expiryDate).toLocaleDateString('ru-RU')}`
      : '';

    await logAudit({
      entity_type: 'document' as AuditEntityType,
      entity_id: created.id,
      action: 'create',
      summary: `Загружен документ ${entityLabel}: ${docLabel}${expiryPart}`,
    });
  }

  return { success: true };
}
