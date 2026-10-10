'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  CheckCircle2,
  Paperclip,
  Bell,
  Sparkles,
  Loader2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { markDriverOnboarded } from './onboarding-actions';

type Step = {
  num: number;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    num: 1,
    Icon: Rocket,
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-600',
    title: 'Начни рейс',
    text: 'Когда выехал — нажми «Начать рейс» в карточке. Офис увидит, что ты в пути.',
  },
  {
    num: 2,
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Заверши рейс',
    text: 'После выгрузки укажи дату завершения. Система сама подтянет пробег и расход из Logisat.',
  },
  {
    num: 3,
    Icon: Paperclip,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Загрузи CMR',
    text: 'Сфотографируй CMR с отметкой о выгрузке и загрузи через кнопку «📎 Загрузить документы».',
  },
  {
    num: 4,
    Icon: Bell,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'Следи за сроками',
    text: 'В разделе «Напоминания» — все сроки твоих документов: виза, права, карта тахографа.',
  },
];

export default function OnboardingCard({ driverName }: { driverName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHidden, setIsHidden] = useState(false);

  if (isHidden) return null;

  function handleDismiss() {
    setIsHidden(true);
    startTransition(async () => {
      await markDriverOnboarded();
      router.refresh();
    });
  }

  return (
    <div className="card overflow-hidden border-brand-200 animate-fade-in relative">
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center
                   text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        aria-label="Скрыть"
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>

      <div className="h-1.5 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-500" />

      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500
                          flex items-center justify-center shrink-0 shadow-brand">
            <Sparkles className="w-6 h-6 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <div className="text-lg md:text-xl font-bold text-slate-900 break-words">
              Привет, {driverName}!
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Пара коротких советов, как пользоваться приложением
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {STEPS.map((step) => {
            const Icon = step.Icon;
            return (
              <div key={step.num} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl ${step.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${step.iconColor}`} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm">
                    {step.num}. {step.title}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {step.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="mt-5 w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400
                     text-white font-semibold py-3 rounded-xl shadow-brand
                     transition-all active:scale-[0.98]
                     inline-flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохраняю…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              Всё понял, поехали
            </>
          )}
        </button>
      </div>
    </div>
  );
}
