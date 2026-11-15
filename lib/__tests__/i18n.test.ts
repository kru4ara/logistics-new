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

  it('украинский — не копия русского: совпадений не больше 20% (одинаковые слова вроде «Статус» допустимы)', () => {
    const uk = entries(MESSAGES.uk);
    const same = uk.filter(([k, v]) => v === ruEntries.get(k));
    expect(same.length / uk.length).toBeLessThan(0.2);
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
  // Заказы — список
  'app/trips/page.tsx',
  'app/trips/TripsBulkList.tsx',
  'app/trips/TripsBulkListWrapper.tsx',
  'app/trips/TripFilters.tsx',
  'app/trips/SearchInput.tsx',
  'app/trips/OverlapWarning.tsx',
  'app/trips/RecalcAllCoordsButton.tsx',
  'app/trips/DownloadButton.tsx',
  // Заказы — карточка, создание, редактирование
  'app/trips/[id]/page.tsx',
  'app/trips/[id]/TripHeader.tsx',
  'app/trips/[id]/TripInfo.tsx',
  'app/trips/[id]/TripEconomics.tsx',
  'app/trips/[id]/TripCargoBlock.tsx',
  'app/trips/[id]/CargoForm.tsx',
  'app/trips/[id]/TripSegmentsBlock.tsx',
  'app/trips/[id]/SegmentForm.tsx',
  'app/trips/[id]/SegmentExecutorBlock.tsx',
  'app/trips/[id]/SegmentStopsBlock.tsx',
  'app/trips/[id]/SegmentAddressBlock.tsx',
  'app/trips/[id]/SegmentCargoSelector.tsx',
  'app/trips/[id]/SegmentDocxButton.tsx',
  'app/trips/[id]/SegmentDriverDocxButton.tsx',
  'app/trips/[id]/SendSegmentTaskButton.tsx',
  'app/trips/[id]/SendTaskButton.tsx',
  'app/trips/[id]/SyncLogisatButton.tsx',
  'app/trips/[id]/RecalcCoordsButton.tsx',
  'app/trips/[id]/task-actions.ts',
  'app/trips/[id]/edit/page.tsx',
  'app/trips/[id]/edit/EditTripForm.tsx',
  'app/trips/new/page.tsx',
  'app/trips/new/NewTripForm.tsx',
  'app/trips/AddExpenseForm.tsx',
  'app/trips/EditExpenseDialog.tsx',
  'app/trips/ExpensesList.tsx',
  'app/components/SubmitButton.tsx',
  'app/components/CopyBlock.tsx',
  'app/driver/DocumentList.tsx',
  'app/driver/TripStatusButtons.tsx',
  'app/driver/FileUpload.tsx',
  // Водители
  'app/drivers/page.tsx',
  // new/page.tsx не в списке: в нём текст журнала аудита (данные)
  'app/drivers/kpi/page.tsx',
  'app/drivers/[id]/page.tsx',
  'app/drivers/[id]/edit/page.tsx',
  'app/drivers/[id]/DriverHeader.tsx',
  'app/drivers/[id]/DriverStats.tsx',
  'app/drivers/[id]/DriverTrips.tsx',
  'app/drivers/[id]/DriverCardDownload.tsx',
  'app/drivers/[id]/DriverFinance.tsx',
  'app/drivers/[id]/TelegramLinkCard.tsx',
  'app/drivers/[id]/telegram-link-actions.ts',
  // Клиенты, подрядчики, локации
  'app/clients/ClientCardActions.tsx',
  'app/clients/MergeClientDialog.tsx',
  'app/clients/[id]/edit/page.tsx',
  'app/clients/[id]/page.tsx',
  'app/clients/delete/[id]/page.tsx',
  'app/clients/page.tsx',
  'app/contractors/ContractorCardActions.tsx',
  'app/contractors/MergeContractorDialog.tsx',
  'app/contractors/[id]/edit/page.tsx',
  'app/contractors/[id]/page.tsx',
  'app/contractors/new/page.tsx',
  'app/contractors/page.tsx',
  'app/locations/[id]/edit/page.tsx',
  'app/locations/new/page.tsx',
  'app/locations/page.tsx',
  // Машины, менеджеры, общие расходы
  'app/fixed-cost-actions.ts',
  'app/fixed-costs/[id]/edit/page.tsx',
  'app/fixed-costs/new/page.tsx',
  'app/fixed-costs/page.tsx',
  'app/managers/[id]/page.tsx',
  'app/managers/new/page.tsx',
  'app/managers/page.tsx',
  'app/truck-actions.ts',
  'app/trucks/[id]/edit/EditTruckForm.tsx',
  'app/trucks/[id]/edit/page.tsx',
  'app/trucks/[id]/page.tsx',
  'app/trucks/new/NewTruckForm.tsx',
  'app/trucks/new/page.tsx',
  'app/trucks/page.tsx',
  // Отчёты, статистика, «Сегодня», главная
  'app/page.tsx',
  'app/reports/DownloadButton.tsx',
  'app/reports/cargo/page.tsx',
  'app/reports/contractors/page.tsx',
  'app/reports/excel/ExportForm.tsx',
  'app/reports/excel/page.tsx',
  'app/reports/logisat/LogisatProblemsList.tsx',
  'app/reports/logisat/page.tsx',
  'app/reports/page.tsx',
  'app/statistics/StatisticsBreakdown.tsx',
  'app/statistics/StatisticsCapex.tsx',
  'app/statistics/StatisticsHeader.tsx',
  'app/statistics/StatisticsLegend.tsx',
  'app/statistics/StatisticsSummary.tsx',
  'app/statistics/StatisticsTable.tsx',
  'app/statistics/page.tsx',
  'app/today/components/ActiveTripCard.tsx',
  'app/today/components/EmptyBlock.tsx',
  'app/today/components/EventCard.tsx',
  'app/today/components/FuelList.tsx',
  'app/today/components/TodayAttention.tsx',
  'app/today/components/TodayStats.tsx',
  'app/today/lib/dates.ts',
  'app/today/lib/events.ts',
  'app/today/lib/relations.ts',
  'app/today/page.tsx',
  'lib/dashboard/category.ts',
  'lib/dashboard/reminders.ts',
  // Напоминания, компоненты, журнал, Logisat, маршруты, карта, поиск
  'app/audit/page.tsx',
  'app/components/AdminOnboardingCard.tsx',
  'app/components/AppShell.tsx',
  'app/components/AppShellClient.tsx',
  'app/components/DocumentUpload.tsx',
  'app/components/DriverPassportUpload.tsx',
  'app/components/DuplicateChecker.tsx',
  'app/components/I18nProvider.tsx',
  'app/components/ServiceWorkerRegister.tsx',
  'app/components/Toaster.tsx',
  'app/components/dashboard/DashboardAttention.tsx',
  'app/components/dashboard/DashboardMonthStats.tsx',
  'app/components/dashboard/DashboardTotals.tsx',
  'app/error.tsx',
  'app/logisat-actions.ts',
  'app/logisat/LogisatTestForm.tsx',
  'app/logisat/page.tsx',
  'app/map/MapView.tsx',
  'app/map/MapViewWrapper.tsx',
  'app/map/page.tsx',
  'app/reminders/ReminderCard.tsx',
  'app/reminders/[id]/edit/page.tsx',
  'app/reminders/new/page.tsx',
  'app/reminders/page.tsx',
  'app/routes/DownloadButton.tsx',
  'app/routes/export/page.tsx',
  'app/routes/page.tsx',
  'app/search/actions.ts',
  'app/search/page.tsx',
  // Приложение водителя
  'app/driver/OnboardingCard.tsx',
  'app/driver/TripsList.tsx',
  'app/driver/balance/page.tsx',
  'app/driver/expense-actions.ts',
  'app/driver/logisat/LogisatForm.tsx',
  'app/driver/logisat/actions.ts',
  'app/driver/logisat/page.tsx',
  'app/driver/onboarding-actions.ts',
  'app/driver/page.tsx',
  'app/driver/reminders-actions.ts',
  'app/driver/reminders/page.tsx',
  'app/driver/stats/page.tsx',
  'app/driver/trips/[id]/page.tsx',
  // Задание водителю, Excel-выгрузка
  'app/api/export/route.ts',
  'lib/driver-locale.ts',
  'lib/trip-task-text.ts',
  // DOCX-задание водителю
  'app/api/trips/[id]/segment/[segId]/driver-docx/route.ts',
  // Первые шаги
  'app/components/HideSetupButton.tsx',
  'app/components/SetupChecklist.tsx',
  'app/setup-actions.ts',
  'lib/setup-steps.ts',
  // Импорт из Excel
  'app/api/import/template/route.ts',
  'app/settings/import/ImportCard.tsx',
  'app/settings/import/page.tsx',
  'lib/import-excel.ts',
  // receivables
  'app/receivables/MarkPaidButton.tsx',
  'app/receivables/page.tsx',
  'app/trips/[id]/PaymentBlock.tsx',
  'lib/receivables.ts',
  // invoices
  'app/api/invoices/[tripId]/pdf/route.ts',
  'app/clients/RequisitesFields.tsx',
  'app/trips/[id]/InvoiceBlock.tsx',
  'lib/invoice-rules.ts',
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

describe('формы числа и месяцы', () => {
  it('рейсы: 1 / 2 / 5 / 21 по правилам каждого языка', async () => {
    const { tPlural } = await import('../i18n/translate');
    const say = (l: 'ru' | 'pl' | 'en' | 'uk', n: number) => tPlural(createT(MESSAGES[l]), l, 'plural.trip', n);
    expect([1, 2, 5, 21].map((n) => say('ru', n))).toEqual(['1 рейс', '2 рейса', '5 рейсов', '21 рейс']);
    expect([1, 2, 5, 22].map((n) => say('pl', n))).toEqual(['1 kurs', '2 kursy', '5 kursów', '22 kursy']);
    expect([1, 2].map((n) => say('en', n))).toEqual(['1 trip', '2 trips']);
    expect([1, 3, 11].map((n) => say('uk', n))).toEqual(['1 рейс', '3 рейси', '11 рейсів']);
  });

  it('месяцы через Intl, с заглавной', async () => {
    const { monthNames } = await import('../i18n/format');
    expect(monthNames('ru')[0]).toBe('Январь');
    expect(monthNames('pl')[0]).toBe('Styczeń');
    expect(monthNames('en')[11]).toBe('December');
    expect(monthNames('uk')[2]).toBe('Березень');
  });
});

describe('formatDate', () => {
  it('по языку; пусто и мусор — без падения', async () => {
    const { formatDate } = await import('../i18n/format');
    expect(formatDate('2026-11-14', 'pl')).toBe('14.11.2026');
    expect(formatDate('2026-11-14', 'en')).toBe('14/11/2026');
    expect(formatDate(null, 'ru')).toBe('—');
    expect(formatDate('не дата', 'ru')).toBe('не дата');
  });
});
