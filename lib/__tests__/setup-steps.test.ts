import { describe, it, expect } from 'vitest';
import { buildSetupSteps, setupProgress, companyFilled } from '../setup-steps';

const empty = { drivers: 0, trucks: 0, clients: 0, trips: 0 };
const blank = { name: 'Logistics CRM', nip: '', email: '', telegramBot: null };

describe('первые шаги', () => {
  it('новая база: ничего не сделано', () => {
    const steps = buildSetupSteps({ company: blank, configured: false, counts: empty });
    expect(steps.map((s) => s.id)).toEqual(['company', 'telegram', 'drivers', 'trucks', 'clients', 'trip']);
    expect(setupProgress(steps)).toEqual({ done: 0, total: 6, complete: false });
  });

  it('реквизиты — только с названием, NIP и e-mail в настоящей строке', () => {
    expect(companyFilled({ name: 'Acme', nip: '123', email: 'a@b.pl' }, true)).toBe(true);
    expect(companyFilled({ name: 'Acme', nip: '', email: 'a@b.pl' }, true)).toBe(false);
    // значения-заглушки без строки в базе не считаются
    expect(companyFilled({ name: 'Acme', nip: '123', email: 'a@b.pl' }, false)).toBe(false);
  });

  it('всё заполнено → готово', () => {
    const steps = buildSetupSteps({
      company: { name: 'Acme', nip: '1', email: 'a@b.pl', telegramBot: 'acme_bot' },
      configured: true,
      counts: { drivers: 2, trucks: 1, clients: 3, trips: 1 },
    });
    expect(setupProgress(steps).complete).toBe(true);
  });
});
