'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================================
// ЗАГРУЗКА
// ============================================================
export async function uploadDocument(
  tripId: string,
  documentType: string,
  base64Data: string,
  fileName: string
) {
  try {
    const supabase = await createClient();

    const base64 = base64Data.split(',')[1];
    if (!base64) {
      return { success: false, message: 'Некорректные данные файла' };
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const mimeType =
      fileExt === 'pdf' ? 'application/pdf' :
      fileExt === 'jpg' || fileExt === 'jpeg' ? 'image/jpeg' :
      fileExt === 'png' ? 'image/png' :
      fileExt === 'heic' ? 'image/heic' :
      'application/octet-stream';

    const filePath = `trips/${tripId}/${documentType}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[uploadDocument] Storage error:', uploadError);
      return {
        success: false,
        message: `Ошибка загрузки: ${uploadError.message || 'неизвестная ошибка'}`,
      };
    }

    const { error: insertError } = await supabase
      .from('trip_documents')
      .insert([
        {
          trip_id: tripId,
          document_type: documentType,
          file_path: filePath,
          original_name: fileName,
          uploaded_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error('[uploadDocument] DB error:', insertError);
      await supabase.storage.from('documents').remove([filePath]);
      return {
        success: false,
        message: `Ошибка сохранения: ${insertError.message || 'неизвестная ошибка'}`,
      };
    }

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const payload = {
          chat_id: TELEGRAM_CHAT_ID,
          text: `📄 *Документ загружен!*\n\nРейс: \`${tripId}\`\nТип: ${documentType}\nФайл: ${fileName}`,
          parse_mode: 'Markdown',
        };

        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!tgRes.ok) {
          console.error('Telegram error status:', tgRes.status);
        }
      } catch (tgErr) {
        console.error('Telegram fetch failed:', tgErr);
      }
    }

    revalidatePath(`/driver/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: 'Документ загружен!' };
  } catch (error) {
    console.error('[uploadDocument] Unexpected error:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Неизвестная ошибка';
    return { success: false, message: msg };
  }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteDocument(documentId: string, tripId: string) {
  try {
    const supabase = await createClient();

    // 1. Получаем документ, чтобы узнать file_path
    const { data: doc, error: fetchError } = await supabase
      .from('trip_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      console.error('[deleteDocument] Fetch error:', fetchError);
      return {
        success: false,
        message: `Документ не найден: ${fetchError?.message || 'неизвестная ошибка'}`,
      };
    }

    // 2. Удаляем из Storage
    if (doc.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('[deleteDocument] Storage error:', storageError);
        // Не прерываем — удалим запись из БД даже если файл не удалился
      }
    }

    // 3. Удаляем запись из БД
    const { error: deleteError } = await supabase
      .from('trip_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('[deleteDocument] DB error:', deleteError);
      return {
        success: false,
        message: `Ошибка удаления записи: ${deleteError.message || 'неизвестная ошибка'}`,
      };
    }

    revalidatePath(`/driver/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: 'Документ удалён' };
  } catch (error) {
    console.error('[deleteDocument] Unexpected error:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Неизвестная ошибка';
    return { success: false, message: msg };
  }
}
