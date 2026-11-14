'use client';

import {
  FileText,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { updateTrip } from '../../../trip-actions';
import SubmitButton from '../../../components/SubmitButton';
import { useT } from '../../../components/I18nProvider';

type Option = { id: string; label: string };

type Trip = {
  client_id: string | null;
  manager_id: string | null;
  start_fuel_level: number | null;
  client_request_number: string | null;
  client_request_date: string | null;
  profit_mode: string | null;
  start_date: string | null;
  end_date: string | null;
};

type Props = {
  trip: Trip;
  tripId: string;
  clients: Option[];
  /** Менеджеры для назначения (фаза 39). */
  managers: Option[];
  /** Менеджер не может переназначать заказ — это делает офис. */
  canChangeManager: boolean;
};

export default function EditTripForm({
  trip,
  tripId,
  clients,
  managers,
  canChangeManager,
}: Props) {
  const { t } = useT();
  const inputClass = 'input';
  const isForwarding = trip.profit_mode === 'forwarding';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'card p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  return (
    <form action={updateTrip.bind(null, tripId)} className="space-y-4 md:space-y-6">

      {/* ПРЕДУПРЕЖДЕНИЕ ОБ ИЗМЕНЕНИЯХ */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.2} />
        <div>
          <b>{t('tripForm.editWarnTitle')}</b> {t('tripForm.editWarnA')}
          <br />{t('tripForm.editWarnB')} <b>«{t('tripForm.legs')}»</b> {t('tripForm.button', { btn: t('seg.add') })}
          <br />{t('tripForm.editWarnC')} <b>«{t('trip.cargo')}»</b> {t('tripForm.buttonCargo', { btn: t('trip.change') })}
          <br />{t('tripForm.editWarnD')}
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.clientOrder')}
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label className={labelClass}>{t('cargo.client')}</label>
            <select name="client_id" defaultValue={trip.client_id || ''} className={inputClass}>
              <option value="">{t('tripForm.pickClient')}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('tripForm.requestNo')}</label>
            <input type="text" name="client_request_number" defaultValue={trip.client_request_number || ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('tripForm.requestDate')}</label>
            <input type="date" name="client_request_date" defaultValue={trip.client_request_date || ''} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <CalendarDays className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.orderDates')}
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t('trip.start')}</label>
            <input
              type="date"
              name="start_date"
              defaultValue={trip.start_date || ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('trip.finish')}</label>
            <input
              type="date"
              name="end_date"
              defaultValue={trip.end_date || ''}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {isForwarding
            ? t('tripForm.datesFwd')
            : t('tripForm.datesTrip')}
          {' '}{t('tripForm.datesPlanned')}
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.technical')}
        </h2>
        <div>
          <label className={labelClass}>{t('tripForm.fuelLeft')}</label>
          <input type="number" name="start_fuel_level" step="0.01" defaultValue={trip.start_fuel_level || 0} className={inputClass} />
        </div>
      </div>

      {canChangeManager && (
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>
            {t('tripForm.manager')}
          </h2>
          <div>
            <label className={labelClass}>
              {t('tripForm.managerShort')}
              <span className="block text-xs text-slate-500 font-normal mt-0.5">
                {t('tripForm.managerHint')}
              </span>
            </label>
            <select name="manager_id" className={inputClass} defaultValue={trip.manager_id || ''}>
              <option value="">{t('tripForm.noManager')}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href={`/trips/${tripId}`}
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          {t('seg.cancel')}
        </a>
        <SubmitButton
          className="w-full sm:flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
          pendingText={t('tripForm.savingChanges')}
        >
          {t('tripForm.saveChanges')}
        </SubmitButton>
      </div>

    </form>
  );
}
