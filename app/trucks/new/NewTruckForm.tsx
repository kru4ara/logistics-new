'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createTruck } from '../../truck-actions';
import SubmitButton from '../../components/SubmitButton';
import { useT } from '../../components/I18nProvider';

export default function NewTruckForm() {
  const { t } = useT();
  const [type, setType] = useState<'tractor' | 'trailer'>('tractor');

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  return (
    <form action={createTruck} className="space-y-4 md:space-y-6">

      {/* ОСНОВНЫЕ ДАННЫЕ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>{t('trk.main')}</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t('trk.plate')}</label>
            <input
              type="text"
              name="registration_number"
              required
              placeholder="WI042NM"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('trk.typeReq')}</label>
            <select
              name="type"
              required
              value={type}
              onChange={(e) => setType(e.target.value as 'tractor' | 'trailer')}
              className={inputClass}
            >
              <option value="tractor">{t('trips.filterTractor')}</option>
              <option value="trailer">{t('seg.trailer')}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('trk.make')}</label>
            <input
              type="text"
              name="brand"
              placeholder={type === 'tractor' ? 'Scania, DAF, MAN…' : 'Krone, Wielton…'}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('trk.model')}</label>
            <input
              type="text"
              name="model"
              placeholder={type === 'tractor' ? 'R450, XF 106…' : 'SD, Profi Liner…'}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('trk.yearMade')}</label>
            <input
              type="number"
              name="year"
              min="1950"
              max="2100"
              placeholder="2020"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>VIN</label>
            <input
              type="text"
              name="vin"
              placeholder="XLRTEH4300G…"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* СТРАХОВКИ — общие для обоих типов */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>{t('trk.insuranceT')}</h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t('trk.insuranceTo')}</label>
            <input type="date" name="truck_insurance_expiry" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('trk.borderInsTo')}</label>
            <input type="date" name="border_insurance_expiry" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ТОЛЬКО ДЛЯ ТЯГАЧА */}
      {type === 'tractor' && (
        <>
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>{t('trk.serviceT')}</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('trk.serviceTo')}</label>
                <input type="date" name="to_expiry" className={inputClass} />
                <p className="text-xs text-slate-400 mt-1">
                  {t('trk.serviceHint')}
                </p>
              </div>
              <div>
                <label className={labelClass}>{t('trk.inspectionTo')}</label>
                <input type="date" name="tech_inspection_expiry" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>{t('trk.tachoFuel')}</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('trk.tachoCalTo')}</label>
                <input type="date" name="tachograph_calibration_expiry" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('trk.fuelCard')}</label>
                <input
                  type="text"
                  name="fuel_card_number"
                  placeholder={t('trk.cardNo')}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>{t('trk.trailerT')}</h2>
            <div>
              <label className={labelClass}>{t('trk.trailerNo')}</label>
              <input
                type="text"
                name="trailer_number"
                placeholder="WI652AX"
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('trk.trailerHint')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ТОЛЬКО ДЛЯ ПРИЦЕПА */}
      {type === 'trailer' && (
        <>
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>{t('trk.inspectionT')}</h2>
            <div>
              <label className={labelClass}>{t('trk.inspectionTo')}</label>
              <input type="date" name="tech_inspection_expiry" className={inputClass} />
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>{t('trk.customsCertT')}</h2>
            <div>
              <label className={labelClass}>{t('trk.customsCertTo')}</label>
              <input type="date" name="customs_certificate_expiry" className={inputClass} />
            </div>
          </div>
        </>
      )}

      {/* КНОПКИ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <Link
          href="/trucks"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          {t('seg.cancel')}
        </Link>
        <SubmitButton
          className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                     text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20
                     transition-all duration-150 active:scale-[0.98]"
          pendingText={t('trk.saving')}
        >
          {t('trk.save')}
        </SubmitButton>
      </div>

    </form>
  );
}
