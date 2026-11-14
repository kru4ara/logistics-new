import { describe, it, expect } from 'vitest';
import { createThrottle, formatAlert, safePath, shouldReport } from '../error-alerts-rules';

describe('оповещения о сбоях', () => {
  it('служебные исключения Next не считаются сбоем', () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' });
    const notFound = Object.assign(new Error('x'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
    expect(shouldReport(redirect)).toBe(false);
    expect(shouldReport(notFound)).toBe(false);
    expect(shouldReport(new Error('column trips.foo does not exist'))).toBe(true);
  });

  it('в сообщении нет query-строки, есть компания и digest', () => {
    const text = formatAlert({
      tenant: 'acme',
      env: 'production',
      err: Object.assign(new Error('boom'), { digest: '123' }),
      method: 'GET',
      path: '/trips?search=Kowalski',
      routeType: 'render',
      routePath: '/trips',
      at: new Date('2026-11-14T10:00:00Z'),
    });
    expect(text).toContain('Сбой · acme');
    expect(text).toContain('GET /trips');
    expect(text).not.toContain('Kowalski');
    expect(text).toContain('digest: 123');
    expect(safePath('/a?b=c')).toBe('/a');
  });

  it('одинаковая ошибка — не чаще раза в окно', () => {
    const allow = createThrottle(1000);
    expect(allow('k', 0)).toBe(true);
    expect(allow('k', 500)).toBe(false);
    expect(allow('other', 500)).toBe(true);
    expect(allow('k', 1500)).toBe(true);
  });
});
