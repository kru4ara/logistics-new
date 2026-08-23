'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function uploadDocument(tripId: string, documentType: string, file: File) {
  try {
    // 1. Загружаем файл в Supabase Storage
    const filePath = `trips/${tripId}/${documentType}-${Date.now()}.${file.name.split('.').pop()}`;
    
    // Supabase Storage (объектное хранилище)
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

    revalidatePath(`/driver/trips/${tripId}`);
    return { success: true, message: 'Документ загружен!' };

  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
