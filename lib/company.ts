import 'server-only';

import { cache } from 'react';
import { createClient } from './supabase/admin';
import {
  companyFromRow,
  LEGACY_COMPANY,
  UNCONFIGURED_COMPANY,
  type Company,
  type CompanyRow,
} from './company-rules';

export type { Company } from './company-rules';
export { renderTerms } from './company-rules';

/**
 * Настройки компании (реквизиты, условия перевозки, Telegram-бот).
 *
 * Источник — public.company_settings (миграция 022), правка — /settings.
 * Один запрос к БД на HTTP-запрос (React cache).
 *
 *   таблицы нет (миграция 022 не применена) → LEGACY_COMPANY (прежние реквизиты);
 *   строки нет (новая база, не настроена)    → UNCONFIGURED_COMPANY (без чужих данных);
 *   другая ошибка БД                         → исключение: лучше ошибка,
 *                                              чем заявка с чужими реквизитами.
 */
export const COMPANY_COLUMNS =
  'name, short_name, address, city, nip, regon, eori, bank, account_eur, account_pln, email, terms, telegram_bot, legacy_login_domain';

/** PostgREST: таблицы нет в схеме (PGRST205) / Postgres: relation does not exist (42P01). */
export function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(error.message ?? '');
}

export const getCompany = cache(async (): Promise<Company> => {
  const admin = await createClient();
  const { data, error } = await admin
    .from('company_settings')
    .select(COMPANY_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return LEGACY_COMPANY;
    throw new Error(`Настройки компании недоступны: ${error.message}`);
  }
  return data ? companyFromRow(data as CompanyRow) : UNCONFIGURED_COMPANY;
});

// ============================================================
// URL приложения (для QR-кода в заявках)
// ============================================================
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'https://logistics-new-ebon.vercel.app');

// Печать для заявок — файл assets/stamp.png
// в бакете documents (загрузка — /settings). Скачиваются сервером
// (lib/docx/assets.ts → downloadAsset), бакет закрытый.
export const STAMP_PATH = 'assets/stamp.png';
