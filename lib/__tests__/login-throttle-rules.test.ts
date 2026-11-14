import { describe, it, expect } from 'vitest';
import {
  evaluateThrottle,
  retryAfterSec,
  throttleMessage,
  normalizeLoginKey,
  clientIpFrom,
  LOGIN_LIMIT,
  IP_LIMIT,
  WINDOW_MS,
} from '../login-throttle-rules';

const now = new Date('2026-11-14T12:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000);
const times = (n: number, everyMin = 1) => Array.from({ length: n }, (_, i) => ago(i * everyMin));

describe('retryAfterSec', () => {
  it('меньше лимита — не блокируем', () => {
    expect(retryAfterSec(times(LOGIN_LIMIT - 1), LOGIN_LIMIT, now)).toBe(0);
  });

  it('лимит набран — ждать, пока самая старая из последних 5 выйдет из окна', () => {
    // попытки 0,1,2,3,4 мин назад → самая старая (4 мин) выйдет через 11 мин
    expect(retryAfterSec(times(5), LOGIN_LIMIT, now)).toBe(11 * 60);
  });

  it('попытки старше окна не считаются', () => {
    const old = [ago(16), ago(17), ago(18), ago(19), ago(20)];
    expect(retryAfterSec([...old, ago(1)], LOGIN_LIMIT, now)).toBe(0);
  });

  it('порядок входных данных не важен', () => {
    expect(retryAfterSec([...times(5)].reverse(), LOGIN_LIMIT, now)).toBe(11 * 60);
  });

  it('много попыток — считается по 5-й с конца, а не по самой старой', () => {
    // 10 попыток раз в минуту: 5-я новейшая — 4 мин назад
    expect(retryAfterSec(times(10), LOGIN_LIMIT, now)).toBe(11 * 60);
  });

  it('ровно на границе окна — уже не в окне', () => {
    const edge = new Date(now.getTime() - WINDOW_MS);
    expect(retryAfterSec([edge, ...times(4)], LOGIN_LIMIT, now)).toBe(0);
  });
});

describe('evaluateThrottle', () => {
  it('нет неудач — вход открыт', () => {
    expect(evaluateThrottle({ loginFailures: [], ipFailures: [], now })).toEqual({ blocked: false });
  });

  it('аккаунт заблокирован, IP чист', () => {
    const d = evaluateThrottle({ loginFailures: times(5), ipFailures: times(5), now });
    expect(d).toEqual({ blocked: true, retryAfterSec: 11 * 60 });
  });

  it('IP перебирает разные аккаунты — блок по IP', () => {
    const d = evaluateThrottle({ loginFailures: [ago(1)], ipFailures: times(IP_LIMIT, 0.25), now });
    expect(d.blocked).toBe(true);
  });

  it('офис за одним IP: 29 неудач разных людей — не блокируем', () => {
    const d = evaluateThrottle({ loginFailures: [ago(1)], ipFailures: times(IP_LIMIT - 1, 0.25), now });
    expect(d).toEqual({ blocked: false });
  });

  it('оба блока — берём большее ожидание', () => {
    // аккаунт: ждать 11 мин; IP: 30-я попытка 2.9 мин назад → ждать 12.1 мин
    const d = evaluateThrottle({ loginFailures: times(5), ipFailures: times(IP_LIMIT, 0.1), now });
    expect(d.blocked && d.retryAfterSec).toBe(726);
  });
});

describe('вспомогательное', () => {
  it('сообщение округляет минуты вверх', () => {
    expect(throttleMessage(61)).toMatch(/2 мин/);
    expect(throttleMessage(1)).toMatch(/1 мин/);
  });

  it('ключ аккаунта: регистр и пробелы не важны', () => {
    expect(normalizeLoginKey('  Ivan@Example.COM ')).toBe('ivan@example.com');
  });

  it('IP: первый из x-forwarded-for, иначе x-real-ip, иначе null', () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIpFrom(h({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
    expect(clientIpFrom(h({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIpFrom(h({}))).toBeNull();
  });
});
