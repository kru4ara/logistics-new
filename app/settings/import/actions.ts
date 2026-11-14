'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../../lib/require-office';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll } from '../../../lib/fetch-all';
import { logAudit } from '../../../lib/audit';
import { syncReminders } from '../../reminder-actions';
import { getT } from '../../../lib/i18n/server';
import {
  IMPORT_TYPES, MAX_IMPORT_ROWS, dedupeKey, parseImport,
  type ImportError, type ImportType,
} from '../../../lib/import-rules';
import { readSheet } from '../../../lib/import-excel';

const MAX_BYTES = 5 * 1024 * 1024;

export type ImportReport =
  | { ok: true; total: number; toAdd: number; errors: ImportError[]; added?: number }
  | { ok: false; message: string };

const KEY_COLUMNS: Record<ImportType, string> = {
  clients: 'name',
  drivers: 'first_name, last_name',
  trucks: 'registration_number',
};

async function prepare(type: ImportType, formData: FormData) {
  const { t } = await getT();
  if (!IMPORT_TYPES.includes(type)) return { error: t('imp.badFile') } as const;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: t('imp.noFile') } as const;
  if (file.size > MAX_BYTES) return { error: t('imp.tooBig', { n: MAX_IMPORT_ROWS }) } as const;

  const sheet = await readSheet(await file.arrayBuffer());
  if ('error' in sheet) {
    return { error: sheet.error === 'tooBig' ? t('imp.tooBig', { n: MAX_IMPORT_ROWS }) : t('imp.badFile') } as const;
  }

  const supabase = await createClient();
  const { data: existing } = await fetchAll(supabase.from(type).select(KEY_COLUMNS[type]));
  const keys = new Set(((existing || []) as unknown as Record<string, unknown>[]).map((r) => dedupeKey(type, r)));
  return { parsed: parseImport(type, sheet.rows, keys), supabase } as const;
}

/** Проверить файл: что добавится и где ошибки. В базу ничего не пишет. */
export async function checkImport(type: ImportType, formData: FormData): Promise<ImportReport> {
  await requireCapability('settings.edit');
  const res = await prepare(type, formData);
  if ('error' in res) return { ok: false, message: res.error as string };
  const { parsed } = res;
  return { ok: true, total: parsed.total, toAdd: parsed.valid.length, errors: parsed.errors };
}

/** Импортировать корректные строки. Дубли и строки с ошибками пропускаются. */
export async function runImport(type: ImportType, formData: FormData): Promise<ImportReport> {
  await requireCapability('settings.edit');
  const res = await prepare(type, formData);
  if ('error' in res) return { ok: false, message: res.error as string };
  const { parsed, supabase } = res;
  const { t } = await getT();

  let added = 0;
  const records = parsed.valid.map((v) => v.record);
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200);
    const { data, error } = await supabase.from(type).insert(chunk).select(`id, ${KEY_COLUMNS[type]}`);
    if (error) return { ok: false, message: t('dir.addError', { msg: error.message }) };
    for (const row of (data || []) as unknown as Record<string, string>[]) {
      added++;
      if (type === 'drivers') {
        await syncReminders('driver', row.id);
        await logAudit({ entity_type: 'driver', entity_id: row.id, action: 'create', summary: `Импорт из Excel: водитель «${row.first_name} ${row.last_name}»` });
      } else if (type === 'clients') {
        await logAudit({ entity_type: 'client', entity_id: row.id, action: 'create', summary: `Импорт из Excel: клиент «${row.name}»` });
      } else {
        await syncReminders('truck', row.id);
      }
    }
  }

  revalidatePath(`/${type}`);
  revalidatePath('/');
  return { ok: true, total: parsed.total, toAdd: parsed.valid.length, errors: parsed.errors, added };
}
