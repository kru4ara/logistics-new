import { describe, it, expect, vi } from 'vitest';
import { isTokenFormat, portalLocale, publicStatus, mapLink } from '../portal-rules';

vi.mock('server-only', () => ({}));

describe('портал клиента', () => {
  it('токен: 32 байта base64url, хранится только хеш', async () => {
    const { newToken, hashToken } = await import('../portal');
    const a = newToken();
    expect(isTokenFormat(a)).toBe(true);
    expect(newToken()).not.toBe(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(isTokenFormat('short')).toBe(false);
    expect(isTokenFormat(a + '/')).toBe(false);
    expect(isTokenFormat(null)).toBe(false);
  });

  it('язык: ?lang, затем Accept-Language, иначе английский', () => {
    expect(portalLocale('pl', 'ru-RU')).toBe('pl');
    expect(portalLocale('xx', 'de-DE,uk;q=0.8,en;q=0.5')).toBe('uk');
    expect(portalLocale(undefined, 'be-BY,be;q=0.9')).toBe('ru');
    expect(portalLocale(undefined, 'de-DE')).toBe('en');
    expect(portalLocale(undefined, null)).toBe('en');
  });

  it('статус для клиента и ссылка на карту', () => {
    expect(['planned', 'active', 'completed', 'invoiced', 'paid', 'cancelled', null].map(publicStatus))
      .toEqual(['planned', 'inTransit', 'delivered', 'invoiced', 'paid', null, null]);
    expect(mapLink(52.123456, 21.0)).toBe('https://www.google.com/maps/search/?api=1&query=52.12346,21.00000');
  });
});
