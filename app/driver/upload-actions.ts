'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logAudit } from '../../lib/audit';
import { requireTripAccess } from '../../lib/driver-access';
import { getT } from '../../lib/i18n/server';
import { createT } from '../../lib/i18n/translate';
import { MESSAGES } from '../../lib/i18n/messages';
import { DEFAULT_LOCALE } from '../../lib/i18n/config';
import { NOT_INVOICED_STATUSES } from '../../lib/to-invoice';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================================
// ЗАГРУЗКА
// ============================================================
// Загрузка файла — prepareDocumentUpload / finishDocumentUpload ниже: файл идёт прямо в
// хранилище, минуя функцию Vercel (лимит тела 4,5 МБ).

type Admin = Awaited<ReturnType<typeof createClient>>;

/** Файл уже в хранилище: запись документа, журнал, сообщение офису. */
async function finalizeUpload(supabase: Admin, tripId: string, documentType: string, filePath: string, fileName: string) {
  const { t } = await getT();
    const { data: created, error: insertError } = await supabase
      .from('trip_documents')
      .insert([
        {
          trip_id: tripId,
          document_type: documentType,
          file_path: filePath,
          original_name: fileName,
          uploaded_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      console.error('[uploadDocument] DB error:', insertError);
      await supabase.storage.from('documents').remove([filePath]);
      return { ok: false as const, message: t('drvApp.saveErr', { msg: insertError.message || t('drvApp.unknownErr') }) };
    }

    // Номер рейса, клиент и статус — для summary и сообщения офису
    let tripLabel = tripId;
    let tripNumber: string | null = null;
    let clientName = '';
    let tripStatus: string | null = null;
    try {
      const { data: trip } = await supabase
        .from('trips')
        .select('trip_number, status, clients(name)')
        .eq('id', tripId)
        .maybeSingle();
      if (trip?.trip_number) {
        tripNumber = String(trip.trip_number);
        tripLabel = `№${trip.trip_number}`;
      }
      tripStatus = (trip?.status as string | null) ?? null;
      const c = trip?.clients as { name?: string } | { name?: string }[] | null | undefined;
      clientName = (Array.isArray(c) ? c[0]?.name : c?.name) ?? '';
    } catch {
      // не критично
    }

    if (created?.id) {
      await logAudit({
        entity_type: 'document',
        entity_id: created.id,
        action: 'create',
        summary: `Загружен документ в рейс ${tripLabel}: ${documentType} · ${fileName}`,
      });
    }

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        // CMR по заказу без счёта — сигнал офису «можно выставлять» со ссылкой.
        // Офисный чат — на языке офиса по умолчанию, как остальные его сообщения.
        const readyToInvoice = documentType === 'cmr' && (NOT_INVOICED_STATUSES as readonly string[]).includes(tripStatus ?? '');
        const officeT = createT(MESSAGES[DEFAULT_LOCALE]);
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
        const text = readyToInvoice
          ? [
              officeT('toinv.tgCmr', { trip: tripNumber ?? tripLabel, client: clientName ? ` · ${clientName}` : '' }),
              appUrl ? `${appUrl}/trips/${tripId}?tab=money#invoice` : null,
            ]
              .filter(Boolean)
              .join('\n')
          : `📄 Документ загружен\n\nРейс: ${tripLabel}${clientName ? ` · ${clientName}` : ''}\nТип: ${documentType}\nФайл: ${fileName}`;
        const payload = {
          chat_id: TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
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

    return { ok: true as const };
}

const EXT_OK = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf']);
const DOC_TYPES = new Set(['cmr', 'other', 'invoice', 'photo']);

/**
 * Прямая загрузка в хранилище, минуя функцию Vercel (её тело — не больше 4,5 МБ, а
 * фото CMR с телефона в base64 бывает 5–8 МБ). Сервер проверяет доступ к рейсу и выдаёт
 * одноразовую ссылку на запись одного файла; браузер кладёт файл сам.
 */
export async function prepareDocumentUpload(tripId: string, documentType: string, fileName: string) {
  const { t } = await getT();
  const access = await requireTripAccess(tripId, { allowLocked: true });
  if (!access.ok) return { ok: false as const, message: access.reason };
  const type = DOC_TYPES.has(documentType) ? documentType : 'other';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!EXT_OK.has(ext)) return { ok: false as const, message: t('shared.badFormat') };
  const supabase = await createClient();
  const path = `trips/${tripId}/${type}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('documents').createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, message: t('drvApp.uploadErr', { msg: error?.message || t('drvApp.unknownErr') }) };
  return { ok: true as const, path, url: data.signedUrl };
}

/** Файл загружен по ссылке из prepareDocumentUpload — записываем документ. */
export async function finishDocumentUpload(tripId: string, documentType: string, path: string, fileName: string) {
  const { t } = await getT();
  try {
    const access = await requireTripAccess(tripId, { allowLocked: true });
    if (!access.ok) return { success: false, message: access.reason };
    const type = DOC_TYPES.has(documentType) ? documentType : 'other';
    // Путь — только тот, что выдан для этого рейса и типа: чужой файл не привязать.
    if (!new RegExp(`^trips/${tripId}/${type}-\\d+\\.[a-z]+$`).test(path)) {
      return { success: false, message: t('drvApp.badFile') };
    }
    const supabase = await createClient();
    const dir = path.slice(0, path.lastIndexOf('/'));
    const name = path.slice(path.lastIndexOf('/') + 1);
    const { data: found } = await supabase.storage.from('documents').list(dir, { search: name, limit: 1 });
    if (!found?.some((f) => f.name === name)) return { success: false, message: t('drvApp.uploadErr', { msg: t('drvApp.unknownErr') }) };
    const done = await finalizeUpload(supabase, tripId, type, path, fileName.slice(0, 200));
    if (!done.ok) return { success: false, message: done.message };
    revalidatePath(`/driver/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: t('drvApp.docUploaded') };
  } catch (error) {
    console.error('[finishDocumentUpload] Unexpected error:', error);
    return { success: false, message: error instanceof Error ? error.message : t('shared.unknownError') };
  }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteDocument(documentId: string, tripId: string) {
  const { t } = await getT();
  try {
    const supabase = await createClient();

    // 1. Получаем документ, чтобы узнать file_path
    const { data: doc, error: fetchError } = await supabase
      .from('trip_documents')
      .select('file_path, document_type, original_name, trip_id')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      console.error('[deleteDocument] Fetch error:', fetchError);
      return {
        success: false,
        message: t('drvApp.docNotFound', { msg: fetchError?.message || t('drvApp.unknownErr') }),
      };
    }

    // Проверяем права по trip_id ИЗ БД, а не по аргументу: иначе можно
    // было бы подсунуть чужой tripId и удалить чужой документ.
    const access = await requireTripAccess(doc.trip_id as string);
    if (!access.ok) {
      return { success: false, message: access.reason };
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
        message: t('drvApp.deleteRecErr', { msg: deleteError.message || t('drvApp.unknownErr') }),
      };
    }

    // Audit
    let tripLabel = tripId;
    try {
      const { data: trip } = await supabase
        .from('trips')
        .select('trip_number')
        .eq('id', tripId)
        .maybeSingle();
      if (trip?.trip_number) tripLabel = `№${trip.trip_number}`;
    } catch {
      // не критично
    }

    const docLabel = doc.original_name
      ? doc.original_name
      : doc.document_type || t('drvApp.untitled');

    await logAudit({
      entity_type: 'document',
      entity_id: documentId,
      action: 'delete',
      summary: `Удалён документ из рейса ${tripLabel}: ${docLabel}`,
    });

    revalidatePath(`/driver/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}`);
    return { success: true, message: t('drvApp.docDeleted') };
  } catch (error) {
    console.error('[deleteDocument] Unexpected error:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : t('shared.unknownError');
    return { success: false, message: msg };
  }
}
