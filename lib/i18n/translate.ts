/**
 * t(key, params) — перевод по ключу «раздел.ключ». Без 'server-only':
 * та же функция работает на сервере (getT) и в клиенте (useT).
 *
 * Ключи типизированы: опечатка в ключе — ошибка tsc. Словари других
 * языков типизированы по русскому: пропущенный ключ — тоже ошибка tsc.
 * Подстановки — {name}: t('login.wait', { min: 5 }).
 */
import type { ru } from './messages/ru';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Словарь любого языка — та же форма, что у русского, значения — строки. */
export type Messages = { [K in keyof typeof ru]: { [L in keyof (typeof ru)[K]]: string } };
export type MessageKey = Leaves<typeof ru>;
export type TParams = Record<string, string | number>;
export type T = (key: MessageKey, params?: TParams) => string;

export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m
  );
}

export function createT(messages: Messages, fallback?: Messages): T {
  return (key, params) => {
    const [section, name] = key.split('.') as [keyof Messages, string];
    const value =
      (messages[section] as Record<string, string> | undefined)?.[name] ??
      (fallback?.[section] as Record<string, string> | undefined)?.[name] ??
      key;
    return interpolate(value, params);
  };
}
