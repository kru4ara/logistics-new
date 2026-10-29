// Тип события страницы «Сегодня» и справочники статусов рейса.
// Вынесено из app/today/page.tsx (Фаза 40).

export type EventItem = {
  kind: 'trip' | 'sub' | 'fwd';
  tripNumber: string | null;
  clientName: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  date: string | null;
  pointLabel?: string;
  driverName?: string | null;
  truckNumber?: string | null;
  href: string;
  tripStatus?: string | null;
};

export const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

export const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
