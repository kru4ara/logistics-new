'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from '../../lib/i18n/config';
import { createT, type Messages, type T } from '../../lib/i18n/translate';

/**
 * Словарь текущего языка для client components. Корневой layout кладёт
 * сюда только словарь выбранного языка.
 */
const I18nContext = createContext<{ locale: Locale; t: T } | null>(null);

export default function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(messages) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** t() в client components. Вне провайдера — ключ как есть (не падаем). */
export function useT(): { t: T; locale: Locale } {
  const ctx = useContext(I18nContext);
  return ctx ?? { t: (key) => key, locale: DEFAULT_LOCALE };
}
