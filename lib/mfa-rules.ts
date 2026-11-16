/**
 * Двухфакторный вход (TOTP, Supabase Auth MFA). Чистые правила — тест
 * lib/__tests__/mfa-rules.test.ts; proxy.ts и страницы входа их только вызывают.
 *
 *   aal1 — вошёл паролем; aal2 — ещё и кодом из приложения.
 *   nextLevel = aal2 — у пользователя есть подтверждённый фактор: без кода дальше нельзя.
 */
export type Aal = string | null | undefined;

export const MFA_VERIFY_PATH = '/login/mfa';
export const MFA_SETUP_PATH = '/account/security';

/** Код ещё не введён, а фактор есть — пускаем только на страницу кода и выход. */
export function needsMfaCode(current: Aal, next: Aal): boolean {
  return next === 'aal2' && current !== 'aal2';
}

/**
 * Компания требует 2FA для сотрудников офиса (office, бухгалтер, менеджер),
 * а у пользователя фактора нет — отправляем подключить. Водителей не трогаем:
 * у них телефон в кабине и вход по фамилии.
 */
export function needsMfaSetup(p: { required: boolean; isStaff: boolean; hasFactor: boolean }): boolean {
  return p.required && p.isStaff && !p.hasFactor;
}

/** 6 цифр, пробелы между группами допустимы («123 456»). */
export function parseTotpCode(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, '');
  return /^\d{6}$/.test(s) ? s : null;
}
