import 'server-only';

import { createClient } from './supabase/admin';

/**
 * Временные ссылки на файлы бакета documents.
 *
 * Бакет закрытый (миграция 021): прямой адрес /object/public/... не
 * открывается. Страница сначала получает документы с проверкой доступа
 * (офис — admin-клиент, водитель — RLS-клиент), и только для них
 * подписывает ссылки. Подпись — admin-клиентом: политик хранилища для
 * authenticated нет намеренно.
 *
 * Ссылка живёт SIGNED_URL_TTL_SEC: открытая дольше страница — обновить.
 */
export const SIGNED_URL_TTL_SEC = 60 * 60;

const BUCKET = 'documents';

/** path → временная ссылка. Пустые и повторяющиеся пути пропускаются. */
export async function signDocumentPaths(
  paths: ReadonlyArray<string | null | undefined>
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};

  const admin = await createClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SEC);
  if (error) {
    console.error('[storage] createSignedUrls failed:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const s of data ?? []) {
    if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
  }
  return out;
}

/** Документы + поле url (временная ссылка или null, если файла нет). */
export async function withSignedUrls<T extends { file_path: string | null }>(
  docs: ReadonlyArray<T>
): Promise<Array<T & { url: string | null }>> {
  const urls = await signDocumentPaths(docs.map((d) => d.file_path));
  return docs.map((d) => ({ ...d, url: d.file_path ? urls[d.file_path] ?? null : null }));
}
