'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function uploadDocument(tripId: string, documentType: string, base64Data: string, fileName: string) {
  try {
    // 1. Преобразуем Base64 в Uint8Array (бинарные данные)
    const base64 = base64Data.split(',')[1]; // удаляем префикс data:...
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 2. Загружаем файл в Supabase Storage
    const filePath = `trips/${tripId}/${documentType}-${Date.now()}.${fileName.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes, {
        contentType: 'application/octet-stream'
      });

    if (uploadError) {
      throw new Error('Ошибка загрузки файла: ' + uploadError.message);
    }

    // 3. Записываем в таблицу trip_documents
    const { error: insertError } = await supabase
      .from('trip_documents')
      .insert([
        {
          trip_id: tripId,
          document_type: documentType,
          file_path: filePath,
          original_name: fileName,
          uploaded_at: new Date().toISOString()
        }
      ]);

    if (insertError) {
      throw new Error('Ошибка записыва в таблицу: ' + insertError.message);
    }

    // 4. Уведомление в Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: `📄 Документ загружен!\n\nРежис: ${tripId}\nТип: ${documentType}\nНазвание: ${fileName}`,
        parse_mode: 'Markdown'
      };

      const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!telegramResponse.ok) {
        console.error('Ошибка передачи в Telegram: ' + telegramResponse.status);
      }
    }

    revalidatePath(`/driver/trips/${tripId}`);
    return { success: true, message: 'Документ загружен!' };

  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
