'use client';

import { useTransition } from 'react';
import {
  Sparkles,
  Package,
  Boxes,
  Users,
  BarChart3,
  Calendar,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';
import { completeAdminOnboarding } from '../admin-onboarding-actions';

const LINKS = [
  {
    href: '/trips',
    title: 'Заказы',
    hint: 'Создание, редактирование, документы, участки и грузы',
    Icon: Package,
    color: 'text-brand-600',
    bg: 'bg-brand-50',
  },
  {
    href: '/forwarding',
    title: 'Экспедирование',
    hint: 'Заявки клиентов на перевозку, точки, подрядчики',
    Icon: Boxes,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    href: '/drivers',
    title: 'Справочники',
    hint: 'Клиенты, водители, машины, подрядчики, локации',
    Icon: Users,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    href: '/reports',
    title: 'Отчёты',
    hint: 'Прибыль, KPI водителей, ошибки Logisat, экспорт',
    Icon: BarChart3,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    href: '/today',
    title: 'Сегодня',
    hint: 'Оперативный экран: загрузки, выгрузки, «требует внимания»',
    Icon: Calendar,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
];

export default function AdminOnboardingCard({ userName }: { userName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    startTransition(async () => {
      await completeAdminOnboarding();
    });
  }

  return (
    <div className="card border-brand-200 bg-gradient-to-br from-brand-50/40 to-white p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-brand">
            <Sparkles className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">
              Добро пожаловать, {userName}!
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Вот ключевые разделы — с чего начать.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          aria-label="Закрыть"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
          ) : (
            <X className="w-4 h-4" strokeWidth={2.2} />
          )}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(({ href, title, hint, Icon, color, bg }) => (
          <a
            key={href}
            href={href}
            className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 transition-all"
          >
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                {hint}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 shrink-0 mt-1" strokeWidth={2.2} />
          </a>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          Позже сможешь вернуться к любому разделу через меню слева.
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-[0.98] shrink-0"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
          ) : (
            <Sparkles className="w-4 h-4" strokeWidth={2.2} />
          )}
          Понятно, начать работу
        </button>
      </div>
    </div>
  );
}
