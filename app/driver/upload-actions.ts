'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function uploadDocument(tripId: string, documentType: string, file: File) {
  try {
    // 1. Загружаем файл в Supabase Storage
    const filePath = `trips/${tripId}/${documentType}-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error('Ошибка загрузки файла: ' + uploadError.message);
    }

    // 2. Записываем в таблицу trip_documents
    const { error: insertError } = await supabase
      .from('trip_documents')
      .insert([
        {
          trip_id: tripId,
          document_type: documentType,
          file_path: filePath,
          original_name: file.name,
          uploaded_at: new Date().toISOString()
        }
      ]);

    if (insertError) {
      throw new Error('Ошибка записыва в таблицу: ' + insertError.message);
    }

    // 3. Уведомление в Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: `📄 Документ загружен!\n\nРежис: ${tripId}\nТип: ${documentType}\nНазвание: ${file.name}`,
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
