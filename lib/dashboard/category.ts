// Палитра графиков и метаданные категорий расходов.
// Вынесено из app/page.tsx (Фаза 40).

export const CHART_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  fuel: { label: 'Топливо', emoji: '⛽' },
  salary: { label: 'ЗП водителя', emoji: '💶' },
  contractor: { label: 'Подрядчик', emoji: '🚛' },
  border: { label: 'Граница', emoji: '🛂' },
  permit: { label: 'Дозвол', emoji: '📋' },
  tlc: { label: 'ТЛЦ', emoji: '🏭' },
  waiting: { label: 'Зона ожидания', emoji: '⏳' },
  repair: { label: 'Ремонт', emoji: '🔧' },
  parking: { label: 'Паркинг', emoji: '🅿️' },
  disinfection: { label: 'Дезинфекция', emoji: '🧴' },
  ex1: { label: 'ЕХ-1', emoji: '🧾' },
  otkat: { label: 'Откат', emoji: '🔄' },
  gps_seal: { label: 'GPS пломба', emoji: '📡' },
  epi: { label: 'EPI', emoji: '📄' },
  etoll: { label: 'e-TOLL', emoji: '🛣' },
  other: { label: 'Другое', emoji: '📌' },
};
