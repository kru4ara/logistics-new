'use client';

import { Truck, Users, Coins } from 'lucide-react';
import type { Option } from './types';

export default function SegmentExecutorBlock({
  executorType,
  setExecutorType,
  contractorId,
  setContractorId,
  contractors,
  truckId,
  setTruckId,
  trucks,
  trailerId,
  setTrailerId,
  trailers,
  driverId,
  setDriverId,
  drivers,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  price,
  setPrice,
  currency,
  setCurrency,
  contractorTruckNumber,
  setContractorTruckNumber,
  contractorDriverName,
  setContractorDriverName,
  contractorTransportType,
  setContractorTransportType,
  contractorTransportTemp,
  setContractorTransportTemp,
  contractorTransportHeight,
  setContractorTransportHeight,
  contractorPaymentDays,
  setContractorPaymentDays,
  contractorPaymentDocType,
  setContractorPaymentDocType,
}: {
  executorType: 'us' | 'contractor';
  setExecutorType: (v: 'us' | 'contractor') => void;
  contractorId: string;
  setContractorId: (v: string) => void;
  contractors: Option[];
  truckId: string;
  setTruckId: (v: string) => void;
  trucks: Option[];
  trailerId: string;
  setTrailerId: (v: string) => void;
  trailers: Option[];
  driverId: string;
  setDriverId: (v: string) => void;
  drivers: Option[];
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  contractorTruckNumber: string;
  setContractorTruckNumber: (v: string) => void;
  contractorDriverName: string;
  setContractorDriverName: (v: string) => void;
  contractorTransportType: string;
  setContractorTransportType: (v: string) => void;
  contractorTransportTemp: string;
  setContractorTransportTemp: (v: string) => void;
  contractorTransportHeight: string;
  setContractorTransportHeight: (v: string) => void;
  contractorPaymentDays: string;
  setContractorPaymentDays: (v: string) => void;
  contractorPaymentDocType: string;
  setContractorPaymentDocType: (v: string) => void;
}) {
  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
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
  );
}
