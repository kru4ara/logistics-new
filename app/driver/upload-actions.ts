'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function uploadDocument(
  tripId: string,
  documentType: string,
  base64Data: string,
  fileName: string
) {
  try {
    const supabase = await createClient();

    // 1. Base64 → Uint8Array
    const base64 = base64Data.split(',')[1];
    if (!base64) {
      return { success: false, message: 'Некорректные данные файла' };
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 2. Определяем MIME и расширение
    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const mimeType =
      fileExt === 'pdf' ? 'application/pdf' :
      fileExt === 'jpg' || fileExt === 'jpeg' ? 'image/jpeg' :
      fileExt === 'png' ? 'image/png' :
      fileExt === 'heic' ? 'image/heic' :
      'application/octet-stream';

    // 3. Загружаем в Storage
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

    // 4. Записываем в БД
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
      // Пробуем удалить уже загруженный файл, чтобы не было мусора
      await supabase.storage.from('documents').remove([filePath]);
      return {
        success: false,
        message: `Ошибка сохранения: ${insertError.message || 'неизвестная ошибка'}`,
      };
    }

    // 5. Уведомление в Telegram (не критично, ошибки игнорируем)
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
