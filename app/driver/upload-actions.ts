'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// Данный файл передаётся в виде строки (байты), чтобы обойти ограничение Next.js
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
        contentType: 'application/octet-stream' // или замените на 'image/png' / 'application/pdf'
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

    revalidatePath(`/driver/trips/${tripId}`);
    return { success: true, message: 'Документ загружен!' };

  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
