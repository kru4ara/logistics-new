import Link from 'next/link';
import { Check } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';

/** «Осталось сделать» по рейсу: CMR → счёт → оплата, каждый шаг ведёт на свою вкладку. */
export default async function TripTodo({
  tripId,
  status,
  cmrCount,
  hasInvoice,
}: {
  tripId: string;
  status: string;
  cmrCount: number;
  hasInvoice: boolean;
  hasContractor?: boolean;
}) {
  const { t } = await getT();
  const invoiced = hasInvoice || status === 'invoiced' || status === 'paid';
  const steps = [
    { done: cmrCount > 0, label: t('tripTabs.todoCmr'), hint: t('tripTabs.todoCmrHint'), tab: 'docs' },
    { done: invoiced, label: t('tripTabs.todoInvoice'), hint: t('tripTabs.todoInvoiceHint'), tab: 'money' },
    { done: status === 'paid', label: t('tripTabs.todoPaid'), hint: t('tripTabs.todoPaidHint'), tab: 'money' },
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-slate-900 mb-3">
        {left ? t('tripTabs.todoTitle', { n: left }) : t('tripTabs.todoDone')}
      </h2>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.label}>
            <Link href={`/trips/${tripId}?tab=${s.tab}`} className="flex items-start gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-slate-50">
              {s.done ? (
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
                </span>
              ) : (
                <span className="mt-0.5 w-5 h-5 rounded-full border-2 border-amber-500 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className={`block text-sm ${s.done ? 'text-slate-500' : 'font-semibold text-slate-900'}`}>{s.label}</span>
                {!s.done && <span className="block text-xs text-slate-500">{s.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
