'use server';

import { createClient } from '../lib/supabase-server';

export type UploadResult = { success: true } | { success: false; error: string };

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

  const { error: dbError } = await supabase.from('documents').insert({
    entity_type: entityType,
    entity_id: entityId,
    document_type: documentType,
    file_path: filePath,
    expiry_date: expiryDate || null,
  });

  if (dbError) {
    // файл уже загружен, но запись не создалась — почистим за собой
    await supabase.storage.from('documents').remove([filePath]);
    return { success: false, error: `Ошибка сохранения: ${dbError.message}` };
  }

  return { success: true };
}
