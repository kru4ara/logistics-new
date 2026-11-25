// Палитра графиков и метаданные категорий расходов.
// Вынесено из app/page.tsx (Фаза 40).

export const CHART_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  fuel: { label: 'trip.fuel', emoji: '⛽' },
  salary: { label: 'expenseCat.salary', emoji: '💶' },
  contractor: { label: 'expenseCat.contractor', emoji: '🚛' },
  border: { label: 'expenseCat.border', emoji: '🛂' },
  permit: { label: 'expenseCat.permit', emoji: '📋' },
  tlc: { label: 'expenseCat.tlc', emoji: '🏭' },
  waiting: { label: 'expenseCat.waiting', emoji: '⏳' },
  repair: { label: 'expenseCat.repair', emoji: '🔧' },
  parking: { label: 'expenseCat.parking', emoji: '🅿️' },
  disinfection: { label: 'expenseCat.disinfection', emoji: '🧴' },
  ex1: { label: 'expenseCat.ex1', emoji: '🧾' },
  otkat: { label: 'expenseCat.otkat', emoji: '🔄' },
  manager_salary: { label: 'expenseCat.manager_salary', emoji: '👔' },
  gps_seal: { label: 'expenseCat.gps_seal', emoji: '📡' },
  epi: { label: 'EPI', emoji: '📄' },
  etoll: { label: 'e-TOLL', emoji: '🛣' },
  other: { label: 'expenseCat.other', emoji: '📌' },
};
