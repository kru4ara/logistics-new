/**
 * «Первые шаги» новой компании: что настроить, чтобы начать работу.
 * Чистая логика без Supabase — покрыта тестом (lib/__tests__/setup-steps.test.ts).
 * Текст подбирает страница по коду шага (правило i18n № 3).
 */
import type { Company } from './company-rules';

export type SetupStepId = 'company' | 'telegram' | 'drivers' | 'trucks' | 'clients' | 'trip';

export type SetupStep = { id: SetupStepId; href: string; done: boolean };

export type SetupCounts = { drivers: number; trucks: number; clients: number; trips: number };

/** Реквизиты считаются заполненными, когда есть название, NIP и e-mail. */
export function companyFilled(c: Pick<Company, 'nip' | 'email' | 'name'>, configured: boolean): boolean {
  return configured && Boolean(c.name.trim() && c.nip.trim() && c.email.trim());
}

export function buildSetupSteps(input: {
  company: Pick<Company, 'nip' | 'email' | 'name' | 'telegramBot'>;
  /** false — строки company_settings нет (новая база). */
  configured: boolean;
  counts: SetupCounts;
}): SetupStep[] {
  const { company, configured, counts } = input;
  return [
    { id: 'company', href: '/settings', done: companyFilled(company, configured) },
    { id: 'telegram', href: '/settings', done: configured && Boolean(company.telegramBot) },
    { id: 'drivers', href: '/drivers/new', done: counts.drivers > 0 },
    { id: 'trucks', href: '/trucks/new', done: counts.trucks > 0 },
    { id: 'clients', href: '/clients/new', done: counts.clients > 0 },
    { id: 'trip', href: '/trips/new', done: counts.trips > 0 },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
