'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  MapPin,
  Flag,
  ShieldCheck,
  Package,
  Coins,
} from 'lucide-react';
import { createCargoWithTrip } from '../../geocode-actions';
import SubmitButton from '../../components/SubmitButton';
import { useT } from '../../components/I18nProvider';

type Location = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  company_name: string | null;
  postal_code: string | null;
  city: string | null;
  address: string | null;
  default_loading_number: string | null;
};

type Option = { id: string; label: string };

type Props = {
  clients: Option[];
  /** Менеджеры для назначения на заказ (фаза 39). */
  managers: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
  /** Сборный рейс: заказ сразу встанет в машину этого рейса. */
  groupLeader?: { id: string; label: string } | null;
};

const emptyAddr = {
  country: '',
  name: '',
  postal_code: '',
  city: '',
  address: '',
  loading_number: '',
};

type AddrState = typeof emptyAddr;

const emptyCustoms = {
  place: '',
  country: '',
  city: '',
  postal_code: '',
  address: '',
};

type CustomsState = typeof emptyCustoms;

export default function NewTripForm({
  clients,
  managers,
  loadingLocations,
  unloadingLocations,
  customsLocations,
  groupLeader = null,
}: Props) {
  const { t } = useT();
  const [from, setFrom] = useState<AddrState>({ ...emptyAddr });
  const [to, setTo] = useState<AddrState>({ ...emptyAddr });
  const [customs, setCustoms] = useState<CustomsState>({ ...emptyCustoms });
  const [fwdOrigin, setFwdOrigin] = useState(false);

  function fillFrom(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setFrom({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function fillTo(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setTo({
      country: loc.country || '',
      name: loc.company_name || '',
      postal_code: loc.postal_code || '',
      city: loc.city || '',
      address: loc.address || '',
      loading_number: loc.default_loading_number || '',
    });
  }

  function fillCustoms(locId: string) {
    if (!locId) return;
    const loc = customsLocations.find((l) => l.id === locId);
    if (!loc) return;
    setCustoms({
      place: loc.name || loc.company_name || '',
      country: loc.country || '',
      city: loc.city || '',
      postal_code: loc.postal_code || '',
      address: loc.address || '',
    });
  }

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'card p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';
  const presetClass =
    'w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-base text-slate-900 font-medium ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-solid focus:border-brand-500 transition-all duration-150';

  return (
    <form action={createCargoWithTrip} className="space-y-4 md:space-y-6">
      {groupLeader && (
        <div className="card p-4 border-l-4 border-indigo-400 text-sm text-slate-700">
          <input type="hidden" name="group_leader" value={groupLeader.id} />
          <div className="font-semibold text-slate-900">{t('group.newOrderTitle', { trip: groupLeader.label })}</div>
          <div>{t('group.newOrderHint')}</div>
        </div>
      )}

      {/* РЕЖИМ РАСЧЁТА И ОТМЕТКИ ЗАКАЗА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Coins className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.marks')}
        </h2>
        <p className="text-xs text-slate-500 -mt-1">
          {t('tripForm.marksHint')}
        </p>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_forwarding"
              value="1"
              checked={fwdOrigin}
              onChange={(e) => setFwdOrigin(e.target.checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{t('tripForm.fwdOrigin')}</span>
              <span className="block text-xs text-slate-500">
                {t('tripForm.fwdOriginHint')}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* КЛИЕНТ И ЗАЯВКА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.clientRequest')}
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label htmlFor="nt-client_id" className={labelClass}>{t('cargo.client')}</label>
            <select id="nt-client_id" name="client_id" className={inputClass}>
              <option value="">{t('tripForm.pickClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nt-client_request_number" className={labelClass}>{t('tripForm.requestNo')}</label>
            <input id="nt-client_request_number" type="text" name="client_request_number" placeholder="ZAM-2026-001" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-client_request_date" className={labelClass}>{t('tripForm.requestDate')}</label>
            <input id="nt-client_request_date" type="date" name="client_request_date" className={inputClass} />
          </div>
        </div>
        <div className="mt-3 md:mt-4">
          <label htmlFor="nt-manager_id" className={labelClass}>
            {t('tripForm.manager')}
            <span className="block text-xs text-slate-500 font-normal mt-0.5">
              {t('tripForm.managerHint')}
            </span>
          </label>
          <select id="nt-manager_id" name="manager_id" className={inputClass}>
            <option value="">{t('tripForm.noManager')}</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ОТКУДА */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <MapPin className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('cargo.fromLoading')}
        </h2>

        <div>
          <label htmlFor="nt-field" className={labelClass}>
            {t('tripForm.pickSaved')}
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">{t('tripForm.fillsBelow')}</span>
          </label>
          <select id="nt-field" onChange={(e) => fillFrom(e.target.value)} className={presetClass} defaultValue="">
            <option value="">{t('addr.pickLocation')}</option>
            {loadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label htmlFor="nt-from_country" className={labelClass}>{t('addr.country')}</label>
            <input id="nt-from_country" type="text" name="from_country" value={from.country}
              onChange={(e) => setFrom({ ...from, country: e.target.value })}
              placeholder={t('cargo.phItaly')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-from_name" className={labelClass}>{t('tripForm.senderName')}</label>
            <input id="nt-from_name" type="text" name="from_name" value={from.name}
              onChange={(e) => setFrom({ ...from, name: e.target.value })}
              placeholder="Caffarel S.p.A." className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-from_postal_code" className={labelClass}>{t('addr.postal')}</label>
            <input id="nt-from_postal_code" type="text" name="from_postal_code" value={from.postal_code}
              onChange={(e) => setFrom({ ...from, postal_code: e.target.value })}
              placeholder="20013" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-from_city" className={labelClass}>{t('addr.city')}</label>
            <input id="nt-from_city" type="text" name="from_city" value={from.city}
              onChange={(e) => setFrom({ ...from, city: e.target.value })}
              placeholder="Magenta" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-from_address" className={labelClass}>{t('addr.address')}</label>
            <input id="nt-from_address" type="text" name="from_address" value={from.address}
              onChange={(e) => setFrom({ ...from, address: e.target.value })}
              placeholder="Via Milano 10" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-from_loading_number" className={labelClass}>{t('tripForm.loadingNo')}</label>
            <input id="nt-from_loading_number" type="text" name="from_loading_number" value={from.loading_number}
              onChange={(e) => setFrom({ ...from, loading_number: e.target.value })}
              placeholder="Ramp 4" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ТАМОЖНЯ (перенесена выше "Куда") */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <ShieldCheck className="w-5 h-5 text-slate-600" strokeWidth={2.2} />
          {t('cargo.customsPlace')}
        </h2>
        <p className="text-xs text-slate-500 -mt-1">
          {t('tripForm.customsHint')}
        </p>

        <div>
          <label htmlFor="nt-field-2" className={labelClass}>
            {t('tripForm.pickSaved')}
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">{t('tripForm.fillsBelow')}</span>
          </label>
          <select id="nt-field-2" onChange={(e) => fillCustoms(e.target.value)} className={presetClass} defaultValue="">
            <option value="">{t('addr.pickLocation')}</option>
            {customsLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div className="md:col-span-2">
            <label htmlFor="nt-customs_place" className={labelClass}>{t('cargo.customsName')}</label>
            <input id="nt-customs_place" type="text" name="customs_place" value={customs.place}
              onChange={(e) => setCustoms({ ...customs, place: e.target.value })}
              placeholder={t('cargo.phTerminal')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-customs_country" className={labelClass}>{t('addr.country')}</label>
            <input id="nt-customs_country" type="text" name="customs_country" value={customs.country}
              onChange={(e) => setCustoms({ ...customs, country: e.target.value })}
              placeholder={t('cargo.phBelarus')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-customs_city" className={labelClass}>{t('addr.city')}</label>
            <input id="nt-customs_city" type="text" name="customs_city" value={customs.city}
              onChange={(e) => setCustoms({ ...customs, city: e.target.value })}
              placeholder={t('cargo.phBrest')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-customs_postal_code" className={labelClass}>{t('addr.postal')}</label>
            <input id="nt-customs_postal_code" type="text" name="customs_postal_code" value={customs.postal_code}
              onChange={(e) => setCustoms({ ...customs, postal_code: e.target.value })}
              placeholder="224000" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-customs_address" className={labelClass}>{t('addr.address')}</label>
            <input id="nt-customs_address" type="text" name="customs_address" value={customs.address}
              onChange={(e) => setCustoms({ ...customs, address: e.target.value })}
              placeholder={t('cargo.phCustomsAddr')} className={inputClass} />
          </div>
        </div>
      </div>

      {/* КУДА (перенесена ниже "Таможни") */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Flag className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('cargo.toUnloading')}
        </h2>

        <div>
          <label htmlFor="nt-field-3" className={labelClass}>
            {t('tripForm.pickSaved')}
            <span className="text-xs text-slate-400 font-normal ml-2 hidden sm:inline">{t('tripForm.fillsBelow')}</span>
          </label>
          <select id="nt-field-3" onChange={(e) => fillTo(e.target.value)} className={presetClass} defaultValue="">
            <option value="">{t('addr.pickLocation')}</option>
            {unloadingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.city ? `· ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 pt-2 border-t border-slate-100">
          <div>
            <label htmlFor="nt-to_country" className={labelClass}>{t('addr.country')}</label>
            <input id="nt-to_country" type="text" name="to_country" value={to.country}
              onChange={(e) => setTo({ ...to, country: e.target.value })}
              placeholder={t('cargo.phBelarus')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-to_name" className={labelClass}>{t('tripForm.receiverName')}</label>
            <input id="nt-to_name" type="text" name="to_name" value={to.name}
              onChange={(e) => setTo({ ...to, name: e.target.value })}
              placeholder={t('cargo.phTerminal')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-to_postal_code" className={labelClass}>{t('addr.postal')}</label>
            <input id="nt-to_postal_code" type="text" name="to_postal_code" value={to.postal_code}
              onChange={(e) => setTo({ ...to, postal_code: e.target.value })}
              placeholder="224000" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-to_city" className={labelClass}>{t('addr.city')}</label>
            <input id="nt-to_city" type="text" name="to_city" value={to.city}
              onChange={(e) => setTo({ ...to, city: e.target.value })}
              placeholder={t('cargo.phBrest')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-to_address" className={labelClass}>{t('addr.address')}</label>
            <input id="nt-to_address" type="text" name="to_address" value={to.address}
              onChange={(e) => setTo({ ...to, address: e.target.value })}
              placeholder={t('cargo.phUnloadAddr')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-to_loading_number" className={labelClass}>{t('tripForm.loadingNo')}</label>
            <input id="nt-to_loading_number" type="text" name="to_loading_number" value={to.loading_number}
              onChange={(e) => setTo({ ...to, loading_number: e.target.value })}
              placeholder="Ramp 1" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ГРУЗ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Package className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('tripForm.cargo')}
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="nt-label" className={labelClass}>{t('cargo.name')}</label>
            <input id="nt-label" type="text" name="label" required
              placeholder={t('cargo.phName')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-cargo_type" className={labelClass}>{t('cargo.type')}</label>
            <input id="nt-cargo_type" type="text" name="cargo_type" placeholder={t('cargo.phType')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-weight_kg" className={labelClass}>{t('cargo.weight')}</label>
            <input id="nt-weight_kg" type="number" name="weight_kg" step="0.01" placeholder="22000" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-pallets" className={labelClass}>{t('cargo.pallets')}</label>
            <input id="nt-pallets" type="number" name="pallets" step="1" min="0" placeholder="22" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="nt-notes" className={labelClass}>{t('tripForm.notes')}</label>
            <textarea id="nt-notes" name="notes" rows={2} className={inputClass} placeholder={t('cargo.phNotes')} />
          </div>
        </div>
      </div>

      {/* ФРАХТ */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Coins className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          {t('cargo.freight')}
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="md:col-span-2">
            <label htmlFor="nt-freight_amount" className={labelClass}>{t('seg.amount')}</label>
            <input id="nt-freight_amount" type="number" name="freight_amount" step="0.01" min="0" placeholder="0.00" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nt-freight_currency" className={labelClass}>{t('seg.currency')}</label>
            <select id="nt-freight_currency" name="freight_currency" className={inputClass} defaultValue="EUR">
              <option value="EUR">EUR €</option>
              <option value="PLN">PLN zł</option>
              <option value="BYN">BYN Br</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {t('tripForm.freightHint')}
        </p>
      </div>

      {/* КНОПКИ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <Link
          href="/trips"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          {t('seg.cancel')}
        </Link>
        <SubmitButton
          className="w-full sm:flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
          pendingText={t('tripForm.creating')}
        >
          {t('tripForm.create')}
        </SubmitButton>
      </div>

    </form>
  );
}
