'use client';

import { useState, useTransition } from 'react';
import {
  Truck,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { createSegment, updateSegment } from './segment-actions';
import type { Location, Option, CargoOption, Addr, Stop, SegmentData } from './types';
import SegmentAddressBlock from './SegmentAddressBlock';
import SegmentStopsBlock from './SegmentStopsBlock';
import SegmentExecutorBlock from './SegmentExecutorBlock';
import SegmentCargoSelector from './SegmentCargoSelector';

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

  // Синхронизация с initialData делается НЕ через эффект.
  // initialData всегда соответствует segmentId, поэтому форма
  // перемонтируется при смене сегмента (см. key в TripSegmentsBlock) —
  // начальные значения берутся прямо из useState, без каскадного рендера
  // (react-hooks/set-state-in-effect).
   

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
          <SegmentExecutorBlock
            executorType={executorType}
            setExecutorType={setExecutorType}
            contractorId={contractorId}
            setContractorId={setContractorId}
            contractors={contractors}
            truckId={truckId}
            setTruckId={setTruckId}
            trucks={trucks}
            trailerId={trailerId}
            setTrailerId={setTrailerId}
            trailers={trailers}
            driverId={driverId}
            setDriverId={setDriverId}
            drivers={drivers}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            price={price}
            setPrice={setPrice}
            currency={currency}
            setCurrency={setCurrency}
            contractorTruckNumber={contractorTruckNumber}
            setContractorTruckNumber={setContractorTruckNumber}
            contractorDriverName={contractorDriverName}
            setContractorDriverName={setContractorDriverName}
            contractorTransportType={contractorTransportType}
            setContractorTransportType={setContractorTransportType}
            contractorTransportTemp={contractorTransportTemp}
            setContractorTransportTemp={setContractorTransportTemp}
            contractorTransportHeight={contractorTransportHeight}
            setContractorTransportHeight={setContractorTransportHeight}
            contractorPaymentDays={contractorPaymentDays}
            setContractorPaymentDays={setContractorPaymentDays}
            contractorPaymentDocType={contractorPaymentDocType}
            setContractorPaymentDocType={setContractorPaymentDocType}
          />

          {/* ГРУЗЫ */}
          <SegmentCargoSelector
            cargoList={cargoList}
            selectedCargo={selectedCargo}
            onToggle={toggleCargo}
          />

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
              className="input"
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
