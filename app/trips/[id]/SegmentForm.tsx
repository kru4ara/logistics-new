'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Truck,
  Users,
  X,
  Check,
  Loader2,
  Package,
  Coins,
} from 'lucide-react';
import { createSegment, updateSegment } from './segment-actions';
import type { Location, Option, CargoOption, Addr, Stop, SegmentData } from './types';
import SegmentAddressBlock from './SegmentAddressBlock';
import SegmentStopsBlock from './SegmentStopsBlock';

function toAddr(
  country: string | null,
  city: string | null,
  company: string | null,
  address: string | null,
  postal_code: string | null
): Addr {
  return {
    country: country || '',
    city: city || '',
    company: company || '',
    address: address || '',
    postal_code: postal_code || '',
  };
}

function stopIsEmpty(s: Stop): boolean {
  return !s.country && !s.city && !s.company && !s.address && !s.postal_code;
}

export default function SegmentForm({
  tripId,
  segmentId,
  initialData,
  initialCargoIds,
  contractors,
  trucks,
  trailers,
  drivers,
  loadingLocations,
  unloadingLocations,
  customsLocations,
  cargoList,
  onClose,
  onSaved,
}: {
  tripId: string;
  segmentId?: string;
  initialData?: Partial<SegmentData>;
  initialCargoIds?: string[];
  contractors: Option[];
  trucks: Option[];
  trailers: Option[];
  drivers: Option[];
  loadingLocations: Location[];
  unloadingLocations: Location[];
  customsLocations: Location[];
  cargoList: CargoOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(segmentId);

  const [executorType, setExecutorType] = useState<'us' | 'contractor'>(
    (initialData?.executor_type as 'us' | 'contractor') || 'us'
  );
  const [contractorId, setContractorId] = useState(initialData?.contractor_id || '');
  const [truckId, setTruckId] = useState(initialData?.truck_id || '');
  const [trailerId, setTrailerId] = useState(initialData?.trailer_id || '');
  const [driverId, setDriverId] = useState(initialData?.driver_id || '');
  const [dateFrom, setDateFrom] = useState(initialData?.date_from || '');
  const [dateTo, setDateTo] = useState(initialData?.date_to || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [price, setPrice] = useState<string>(
    initialData?.price != null ? String(initialData.price) : ''
  );
  const [currency, setCurrency] = useState(initialData?.currency || 'EUR');
  const [contractorTruckNumber, setContractorTruckNumber] = useState(initialData?.contractor_truck_number || '');
  const [contractorDriverName, setContractorDriverName] = useState(initialData?.contractor_driver_name || '');
  const [contractorPaymentDays, setContractorPaymentDays] = useState<string>(
     initialData?.contractor_payment_days != null ? String(initialData.contractor_payment_days) : ''
  );
  const [contractorPaymentDocType, setContractorPaymentDocType] = useState(
     initialData?.contractor_payment_document_type || 'originals'
  );
  
  const [contractorTransportType, setContractorTransportType] = useState(initialData?.contractor_transport_type || 'standard');
  const [contractorTransportTemp, setContractorTransportTemp] = useState(initialData?.contractor_transport_temperature || '');
  const [contractorTransportHeight, setContractorTransportHeight] = useState(initialData?.contractor_transport_height || '');

  const [from, setFrom] = useState<Addr>(
    toAddr(
      initialData?.from_country ?? null,
      initialData?.from_city ?? null,
      initialData?.from_company ?? null,
      initialData?.from_address ?? null,
      initialData?.from_postal_code ?? null
    )
  );
  const [to, setTo] = useState<Addr>(
    toAddr(
      initialData?.to_country ?? null,
      initialData?.to_city ?? null,
      initialData?.to_company ?? null,
      initialData?.to_address ?? null,
      initialData?.to_postal_code ?? null
    )
  );

  const [stops, setStops] = useState<Stop[]>(() => {
    if (initialData?.stops && Array.isArray(initialData.stops)) {
      return initialData.stops.map((s) => ({
        type: s.type || 'reload',
        country: s.country || '',
        city: s.city || '',
        company: s.company || '',
        address: s.address || '',
        postal_code: s.postal_code || '',
        date: s.date || '',
      }));
    }
    return [];
  });

  const [selectedCargo, setSelectedCargo] = useState<Set<string>>(
    new Set(initialCargoIds || [])
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialData) {
      setExecutorType((initialData.executor_type as 'us' | 'contractor') || 'us');
      setContractorId(initialData.contractor_id || '');
      setTruckId(initialData.truck_id || '');
      setTrailerId(initialData.trailer_id || '');
      setDriverId(initialData.driver_id || '');
      setDateFrom(initialData.date_from || '');
      setDateTo(initialData.date_to || '');
      setNotes(initialData.notes || '');
      setPrice(initialData.price != null ? String(initialData.price) : '');
      setCurrency(initialData.currency || 'EUR');
      setContractorTruckNumber(initialData.contractor_truck_number || '');
      setContractorDriverName(initialData.contractor_driver_name || '');
      setContractorPaymentDays(initialData.contractor_payment_days != null ? String(initialData.contractor_payment_days) : '');
      setContractorPaymentDocType(initialData.contractor_payment_document_type || 'originals');
      setContractorTransportType(initialData.contractor_transport_type || 'standard');
      setContractorTransportTemp(initialData.contractor_transport_temperature || '');
      setContractorTransportHeight(initialData.contractor_transport_height || '');
      
      setFrom(toAddr(
        initialData.from_country ?? null,
        initialData.from_city ?? null,
        initialData.from_company ?? null,
        initialData.from_address ?? null,
        initialData.from_postal_code ?? null
      ));
      
      setTo(toAddr(
        initialData.to_country ?? null,
        initialData.to_city ?? null,
        initialData.to_company ?? null,
        initialData.to_address ?? null,
        initialData.to_postal_code ?? null
      ));
      
      if (initialData.stops && Array.isArray(initialData.stops)) {
        setStops(initialData.stops.map((s) => ({
          type: s.type || 'reload',
          country: s.country || '',
          city: s.city || '',
          company: s.company || '',
          address: s.address || '',
          postal_code: s.postal_code || '',
          date: s.date || '',
        })));
      } else {
        setStops([]);
      }
    }
    if (initialCargoIds) {
      setSelectedCargo(new Set(initialCargoIds));
    } else {
      setSelectedCargo(new Set());
    }
  }, [initialData, initialCargoIds]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  function fillFromLocation(locId: string) {
    if (!locId) return;
    const loc = loadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setFrom({
      country: loc.country || '',
      city: loc.city || '',
      company: loc.company_name || '',
      address: loc.address || '',
      postal_code: loc.postal_code || '',
    });
  }

  function fillToLocation(locId: string) {
    if (!locId) return;
    const loc = unloadingLocations.find((l) => l.id === locId);
    if (!loc) return;
    setTo({
      country: loc.country || '',
      city: loc.city || '',
      company: loc.company_name || '',
      address: loc.address || '',
      postal_code: loc.postal_code || '',
    });
  }

  function fillFromCargo(cargoId: string) {
    if (!cargoId) return;
    const c = cargoList.find((x) => x.id === cargoId);
    if (!c) return;
    setFrom({
      country: c.from_country || '',
      city: c.from_city || '',
      company: c.from_company || '',
      address: c.from_address || '',
      postal_code: c.from_postal_code || '',
    });
  }

  function fillToCargo(cargoId: string) {
    if (!cargoId) return;
    const c = cargoList.find((x) => x.id === cargoId);
    if (!c) return;
    setTo({
      country: c.to_country || '',
      city: c.to_city || '',
      company: c.to_company || '',
      address: c.to_address || '',
      postal_code: c.to_postal_code || '',
    });
  }

  function toggleCargo(id: string) {
    setSelectedCargo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addStop() {
    setStops([
      ...stops,
      {
        type: 'reload',
        country: '',
        city: '',
        company: '',
        address: '',
        postal_code: '',
        date: '',
      },
    ]);
  }

  function removeStop(idx: number) {
    setStops(stops.filter((_, i) => i !== idx));
  }

  function updateStop(idx: number, field: keyof Stop, value: string) {
    setStops(stops.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function fillStopFromLocation(idx: number, locId: string) {
    if (!locId) return;
    const loc =
      loadingLocations.find((l) => l.id === locId) ||
      unloadingLocations.find((l) => l.id === locId) ||
      customsLocations.find((l) => l.id === locId);
    if (!loc) return;
    setStops(
      stops.map((s, i) =>
        i === idx
          ? {
              ...s,
              country: loc.country || '',
              city: loc.city || '',
              company: loc.company_name || '',
              address: loc.address || '',
              postal_code: loc.postal_code || '',
            }
          : s
      )
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (executorType === 'contractor' && !contractorId) {
      setError('Выберите подрядчика');
      return;
    }
    if (selectedCargo.size === 0) {
      setError('Выберите хотя бы один груз для этого участка');
      return;
    }
    if (!from.city && !from.country && !to.city && !to.country) {
      setError('Заполните «Откуда» или «Куда»');
      return;
    }

    const cleanStops = stops.filter((s) => !stopIsEmpty(s));

    const formData = new FormData();
    formData.set('executor_type', executorType);
    formData.set('contractor_id', contractorId);
    formData.set('truck_id', truckId);
    formData.set('trailer_id', trailerId);
    formData.set('driver_id', driverId);
    formData.set('date_from', dateFrom);
    formData.set('date_to', dateTo);
    formData.set('notes', notes.trim());
    formData.set('from_country', from.country);
    formData.set('from_city', from.city);
    formData.set('from_company', from.company);
    formData.set('from_address', from.address);
    formData.set('from_postal_code', from.postal_code);
    formData.set('to_country', to.country);
    formData.set('to_city', to.city);
    formData.set('to_company', to.company);
    formData.set('to_address', to.address);
    formData.set('to_postal_code', to.postal_code);
    formData.set('stops', JSON.stringify(cleanStops));
    
    if (executorType === 'contractor') {
      formData.set('price', price);
      formData.set('currency', currency);
      formData.set('contractor_truck_number', contractorTruckNumber.trim());
      formData.set('contractor_driver_name', contractorDriverName.trim());
      formData.set('contractor_payment_days', contractorPaymentDays);
      formData.set('contractor_payment_document_type', contractorPaymentDocType);
      formData.set('contractor_transport_type', contractorTransportType);
      formData.set('contractor_transport_temperature', contractorTransportType === 'chlodnia' ? contractorTransportTemp.trim() : '');
      formData.set('contractor_transport_height', contractorTransportType === 'mega' ? contractorTransportHeight.trim() : '');
    }

    selectedCargo.forEach((cid) => formData.append('cargo_ids', cid));

    startTransition(async () => {
      try {
        if (isEdit && segmentId) {
          await updateSegment(segmentId, tripId, formData);
        } else {
          await createSegment(tripId, formData);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message || 'Ошибка сохранения');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-soft-lg max-w-2xl w-full my-8 p-5 md:p-6 space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            {isEdit ? 'Редактировать участок' : 'Добавить участок'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* КТО ЕДЕТ */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700">Кто везёт</h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExecutorType('us')}
                className={`text-left p-3 rounded-lg border-2 transition-all active:scale-[0.98]
                  ${executorType === 'us'
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Truck className={`w-4 h-4 ${executorType === 'us' ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={2.2} />
                  <span className={`font-semibold text-sm ${executorType === 'us' ? 'text-brand-700' : 'text-slate-700'}`}>
                    Наша машина
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExecutorType('contractor')}
                className={`text-left p-3 rounded-lg border-2 transition-all active:scale-[0.98]
                  ${executorType === 'contractor'
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${executorType === 'contractor' ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={2.2} />
                  <span className={`font-semibold text-sm ${executorType === 'contractor' ? 'text-brand-700' : 'text-slate-700'}`}>
                    Подрядчик
                  </span>
                </div>
              </button>
            </div>

            {executorType === 'contractor' && (
              <>
                <div>
                  <label className={labelClass}>Подрядчик *</label>
                  <select
                    value={contractorId}
                    onChange={(e) => setContractorId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">— Выберите подрядчика —</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <Coins className="w-3.5 h-3.5" strokeWidth={2.2} />
                    Стоимость подрядчику
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Сумма</label>
                      <input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="1500"
                        className="input text-base py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Валюта</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="input text-base py-2"
                      >
                        <option value="EUR">EUR €</option>
                        <option value="PLN">PLN zł</option>
                        <option value="BYN">BYN Br</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Расход по этому участку создастся автоматически.
                  </p>
                </div>

                <div className="bg-white rounded-lg border border-violet-200 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-800">
                    <Truck className="w-3.5 h-3.5" strokeWidth={2.2} />
                    Dane pojazdu i kierowcy podwykonawcy
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Numer auta (ciągnik / naczepa)</label>
                      <input
                        type="text"
                        value={contractorTruckNumber}
                        onChange={(e) => setContractorTruckNumber(e.target.value)}
                        placeholder="WS3800K / WS9850C"
                        className="input text-base py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Kierowca</label>
                      <input
                        type="text"
                        value={contractorDriverName}
                        onChange={(e) => setContractorDriverName(e.target.value)}
                        placeholder="Yury Novikau"
                        className="input text-base py-2"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Rodzaj transportu</label>
                        <select
                          value={contractorTransportType}
                          onChange={(e) => {
                            setContractorTransportType(e.target.value);
                            if (e.target.value !== 'chlodnia') setContractorTransportTemp('');
                            if (e.target.value !== 'mega') setContractorTransportHeight('');
                          }}
                          className="input text-base py-2"
                        >
                          <option value="standard">Standard / Plandeka</option>
                          <option value="mega">Mega</option>
                          <option value="chlodnia">Chłodnia</option>
                        </select>
                      </div>
                      
                      {contractorTransportType === 'chlodnia' && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Temperatura</label>
                          <input
                            type="text"
                            value={contractorTransportTemp}
                            onChange={(e) => setContractorTransportTemp(e.target.value)}
                            placeholder="+4 / -18"
                            className="input text-base py-2"
                          />
                        </div>
                      )}
                      
                      {contractorTransportType === 'mega' && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Wysokość załadunku</label>
                          <input
                            type="text"
                            value={contractorTransportHeight}
                            onChange={(e) => setContractorTransportHeight(e.target.value)}
                            placeholder="np. 3.0m"
                            className="input text-base py-2"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Płatność (dni)</label>
                        <input
                          type="number"
                          value={contractorPaymentDays}
                          onChange={(e) => setContractorPaymentDays(e.target.value)}
                          placeholder="30"
                          className="input text-base py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Dokumenty</label>
                        <select
                          value={contractorPaymentDocType}
                          onChange={(e) => setContractorPaymentDocType(e.target.value)}
                          className="input text-base py-2"
                        >
                          <option value="originals">Oryginały CMR</option>
                          <option value="scans">Skany CMR</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

             {executorType === 'us' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Машина</label>
                  <select
                    value={truckId}
                    onChange={(e) => setTruckId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Не указана —</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Прицеп</label>
                  <select
                    value={trailerId}
                    onChange={(e) => setTrailerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Без прицепа —</option>
                    {trailers.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Водитель</label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Не указан —</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Дата с</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Дата по</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ГРУЗЫ */}
          {cargoList.length > 0 && (
            <div className="bg-brand-50 rounded-xl p-4 space-y-3 border border-brand-200">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-700" strokeWidth={2.2} />
                <h4 className="text-sm font-bold text-brand-800">Какие грузы везёт этот участок</h4>
              </div>

              <div className="space-y-1.5">
                {cargoList.map((c) => {
                  const isChecked = selectedCargo.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors
                        ${isChecked ? 'bg-white border-brand-400' : 'bg-white/60 border-brand-100 hover:border-brand-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCargo(c.id)}
                        className="w-4 h-4 accent-brand-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded tabular-nums">
                        {c.position}
                      </span>
                      <span className="text-sm text-slate-800 break-words flex-1">
                        {c.label}
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline tabular-nums">
                        {c.from_city || c.from_country || '?'} → {c.to_city || c.to_country || '?'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ОТКУДА */}
          <SegmentAddressBlock
            type="from"
            title="Откуда"
            color="green"
            data={from}
            onChange={setFrom}
            locations={loadingLocations}
            cargoList={cargoList}
            onFillFromCargo={fillFromCargo}
            onFillFromLocation={fillFromLocation}
          />

          {/* ПРОМЕЖУТОЧНЫЕ ТОЧКИ */}
          <SegmentStopsBlock
            stops={stops}
            loadingLocations={loadingLocations}
            unloadingLocations={unloadingLocations}
            customsLocations={customsLocations}
            onAdd={addStop}
            onRemove={removeStop}
            onUpdate={updateStop}
            onFillFromLocation={fillStopFromLocation}
          />

          {/* КУДА */}
          <SegmentAddressBlock
            type="to"
            title="Куда"
            color="red"
            data={to}
            onChange={setTo}
            locations={unloadingLocations}
            cargoList={cargoList}
            onFillFromCargo={fillToCargo}
            onFillFromLocation={fillToLocation}
          />

          {/* ЗАМЕТКИ */}
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Время прибытия, особенности ..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
