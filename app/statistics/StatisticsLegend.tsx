import { Sigma, Info, Briefcase, Ban } from 'lucide-react';
import { getT } from '../../lib/i18n/server';

export default async function StatisticsLegend() {
  const { t } = await getT();
  return (
    <div className="card p-5 md:p-6">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Sigma className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
        {t('stat.howCalc')}
      </h3>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">{t('stat.INCOME')}</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono">
              {t('stat.incomeF')}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">{t('stat.OPEX')}</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono leading-relaxed">
              {t('stat.opexA')}<br/>
              {t('stat.opexB')}<br/>
              {t('stat.opexC')}<br/>
              {t('stat.opexD')}
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 md:p-4 border border-emerald-100">
            <div className="font-semibold text-emerald-800 mb-1.5">{t('stat.PROFIT')}</div>
            <div className="text-emerald-700 text-xs md:text-sm font-mono">
              {t('stat.profitF')}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">{t('stat.MARGIN')}</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono">
              {t('stat.marginF')}
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-brand-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-brand-800 mb-2 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4" strokeWidth={2.2} />
              {t('stat.rules')}
            </div>
            <ul className="text-brand-900 text-xs md:text-sm space-y-1.5">
              <li>• <b>{t('stat.ruleTrip')}</b>{' '}{t('stat.ruleTripD')}</li>
              <li>• <b>{t('trips.kindForwarding')}</b>{' '}{t('stat.ruleFwdD')}</li>
              <li>• <b>{t('stat.ruleYearly')}</b>{' '}{t('stat.ruleYearlyD')}</li>
              <li>• <b>{t('stat.capex')}</b> → <b>{t('stat.outsidePl')}</b>{t('stat.ruleCapexD')}</li>
            </ul>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 md:p-4 border border-amber-200">
            <div className="font-semibold text-amber-800 mb-2 text-sm flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" strokeWidth={2.2} />
              {t('stat.capexPl')}
            </div>
            <p className="text-amber-900 text-xs md:text-sm">
              {t('stat.ruleCapexL')}
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
              <Ban className="w-4 h-4" strokeWidth={2.2} />
              {t('stat.notCounted')}
            </div>
            <p className="text-slate-600 text-xs md:text-sm">
              {t('stat.notCountedD')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
