import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Rocket } from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { getCompany } from '../../lib/company';
import { UNCONFIGURED_COMPANY } from '../../lib/company-rules';
import { buildSetupSteps, setupProgress, type SetupStepId } from '../../lib/setup-steps';
import { getT } from '../../lib/i18n/server';
import type { MessageKey } from '../../lib/i18n/translate';
import HideSetupButton from './HideSetupButton';

const TEXT: Record<SetupStepId, { title: MessageKey; hint: MessageKey }> = {
  company: { title: 'setup.company', hint: 'setup.companyH' },
  telegram: { title: 'setup.telegram', hint: 'setup.telegramH' },
  drivers: { title: 'setup.drivers', hint: 'setup.driversH' },
  trucks: { title: 'setup.trucks', hint: 'setup.trucksH' },
  clients: { title: 'setup.clients', hint: 'setup.clientsH' },
  trip: { title: 'setup.trip', hint: 'setup.tripH' },
};

async function count(table: string): Promise<number> {
  const supabase = await createClient();
  const { count: n } = await supabase.from(table).select('id', { count: 'exact', head: true });
  return n ?? 0;
}

/**
 * «Первые шаги» на главной офиса: что настроить новой компании.
 * Пропадает сам, когда всё сделано; можно скрыть раньше.
 */
export default async function SetupChecklist() {
  const { t } = await getT();
  const company = await getCompany();
  const [drivers, trucks, clients, trips] = await Promise.all([
    count('drivers'), count('trucks'), count('clients'), count('trips'),
  ]);
  const steps = buildSetupSteps({
    company,
    configured: company !== UNCONFIGURED_COMPANY,
    counts: { drivers, trucks, clients, trips },
  });
  const { done, total, complete } = setupProgress(steps);
  if (complete) return null;
  const next = steps.find((s) => !s.done);

  return (
    <div className="card border-brand-200 p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{t('setup.title')}</h2>
            <p className="text-sm text-slate-500">{t('setup.hint')}</p>
          </div>
        </div>
        <HideSetupButton />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{t('setup.progress', { done, total })}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((s) => {
          const isNext = s.id === next?.id;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  s.done
                    ? 'border-slate-100 bg-slate-50/60'
                    : isNext
                      ? 'border-brand-300 bg-brand-50/50 hover:bg-brand-50'
                      : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.2} />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" strokeWidth={2.2} />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {t(TEXT[s.id].title)}
                  </div>
                  {!s.done && <div className="text-xs text-slate-500 mt-0.5">{t(TEXT[s.id].hint)}</div>}
                </div>
                {isNext && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 shrink-0 mt-0.5">
                    {t('setup.go')}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
