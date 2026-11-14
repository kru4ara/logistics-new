import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES, isLocale, localeFromAcceptLanguage } from '../i18n/config';
import { createT, interpolate, type Messages } from '../i18n/translate';
import { MESSAGES } from '../i18n/messages';
import { ru } from '../i18n/messages/ru';

const CYRILLIC = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const entries = (m: Messages) =>
  Object.entries(m).flatMap(([section, keys]) =>
    Object.entries(keys as Record<string, string>).map(([k, v]) => [`${section}.${k}`, v] as const)
  );

describe('конфигурация языков', () => {
  it('Accept-Language: первый поддерживаемый по весу; белорусский → русский', () => {
    expect(localeFromAcceptLanguage('pl-PL,pl;q=0.9,en;q=0.8')).toBe('pl');
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9,en;q=0.7')).toBe('en');
    expect(localeFromAcceptLanguage('en;q=0.5,uk;q=0.9')).toBe('uk');
    expect(localeFromAcceptLanguage('be-BY')).toBe('ru');
    expect(localeFromAcceptLanguage('fr-FR')).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
  });

  it('isLocale — только четыре языка', () => {
    expect(LOCALES).toEqual(['ru', 'pl', 'en', 'uk']);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('t()', () => {
  it('подстановки; неизвестная подстановка остаётся как есть', () => {
    expect(interpolate('через {min} мин.', { min: 5 })).toBe('через 5 мин.');
    expect(interpolate('{a} и {b}', { a: 1 })).toBe('1 и {b}');
  });

  it('переводит на выбранный язык', () => {
    expect(createT(MESSAGES.pl)('login.submit')).toBe('Zaloguj się');
    expect(createT(MESSAGES.en)('login.errorThrottled', { min: 3 })).toBe('Too many failed attempts. Try again in 3 min.');
  });
});

describe('словари', () => {
  const ruEntries = new Map(entries(ru as unknown as Messages));

  for (const locale of LOCALES) {
    it(`${locale}: нет пустых значений, подстановки совпадают с русскими`, () => {
      for (const [key, value] of entries(MESSAGES[locale])) {
        expect(value.trim(), key).not.toBe('');
        expect(placeholders(value), `${locale} ${key}`).toEqual(placeholders(ruEntries.get(key)!));
      }
    });
  }

  it('польский и английский — без кириллицы (не забыт непереведённый текст)', () => {
    for (const locale of ['pl', 'en'] as const) {
      const leftovers = entries(MESSAGES[locale]).filter(([, v]) => CYRILLIC.test(v)).map(([k]) => k);
      expect(leftovers, locale).toEqual([]);
    }
  });

  it('украинский — не копия русского (совпадения только у одинаковых слов)', () => {
    const SAME_IN_BOTH = new Set(['nav.map', 'nav.statistics', 'nav.managers', 'nav.trucks', 'nav.audit',
      'nav.roleManager', 'settings.email', 'settings.sectionBank', 'settings.accountEur', 'settings.accountPln',
      'login.password', 'nav.logisatFuel', 'nav.myStats']);
    const same = entries(MESSAGES.uk)
      .filter(([k, v]) => v === ruEntries.get(k) && !SAME_IN_BOTH.has(k))
      .map(([k]) => k);
    expect(same).toEqual([]);
  });
});

/**
 * Сторож: в переведённых файлах интерфейса нет русского текста в строках
 * и JSX (комментарии и console.* не в счёт). Раздел переведён — добавить
 * его файлы сюда, чтобы русский не вернулся.
 */
const TRANSLATED_FILES = [
  'app/components/Sidebar.tsx',
  'app/components/Navbar.tsx',
  'app/components/LanguageSwitcher.tsx',
  'app/login/LoginForm.tsx',
  'app/login/page.tsx',
  'app/settings/page.tsx',
];

function cyrillicLiterals(file: string): string[] {
  const src = readFileSync(resolve(__dirname, '../..', file), 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && /^console\./.test(n.expression.getText(sf))) return;
    const text =
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)
        ? n.text
        : ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)
          ? n.text
          : null;
    if (text && CYRILLIC.test(text)) {
      found.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${text.trim().slice(0, 40)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

describe('сторож: переведённые файлы без русского текста', () => {
  it.each(TRANSLATED_FILES)('%s', (file) => {
    expect(cyrillicLiterals(file)).toEqual([]);
  });
});
