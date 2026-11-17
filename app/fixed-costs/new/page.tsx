import { createFixedCost } from '../../fixed-cost-actions';
import SubmitButton from '../../components/SubmitButton';
import { ArrowLeft, Banknote, Save, Info } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewFixedCostPage() {
  const { t } = await getT();
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/fixed-costs"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('fc.all')}
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Banknote className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('fc.add')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {t('fc.addHint')}
          </p>
        </div>

        <form action={createFixedCost} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('fc.details')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.month')}</label>
                <input type="month" name="month_key" required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.date')}</label>
                <input type="date" name="expense_date" required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.costType')}</label>
                <select name="cost_type" required className="input" defaultValue="one_time">
                  <option value="yearly">{t('fc.typeYearly')}</option>
                  <option value="monthly">{t('fc.typeMonthly')}</option>
                  <option value="installment">{t('fc.optInstallment')}</option>
                  <option value="one_time">{t('fc.typeOneTime')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('cclass.label')}</label>
                <select name="cost_class" className="input" defaultValue="operating">
                  <option value="operating">{t('cclass.operating')}</option>
                  <option value="dividends">{t('cclass.dividends')}</option>
                  <option value="cash">{t('cclass.cash')}</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">{t('cclass.hint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.category')}</label>
                <input
                  type="text"
                  name="category"
                  required
                  placeholder={t('fc.phCategory')}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.currency')}</label>
                <select name="currency" required className="input" defaultValue="PLN">
                  <option value="PLN">PLN</option>
                  <option value="BYN">BYN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('fc.amount')}</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="input"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" strokeWidth={2} />
              <span>{t('fc.amountHint')}</span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/fixed-costs"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              {t('seg.cancel')}
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText={t('fc.saving')}
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              {t('fc.save')}
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
