'use client';

import {
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { updateTrip } from '../../../trip-actions';
import SubmitButton from '../../../components/SubmitButton';

type Option = { id: string; label: string };

type Trip = {
  client_id: string | null;
  start_fuel_level: number | null;
  client_request_number: string | null;
  client_request_date: string | null;
};

type Props = {
  trip: Trip;
  tripId: string;
  clients: Option[];
};

export default function EditTripForm({
  trip,
  tripId,
  clients,
}: Props) {
  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'card p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  return (
    <form action={updateTrip.bind(null, tripId)} className="space-y-4 md:space-y-6">

      {/* ПРЕДУПРЕЖДЕНИЕ ОБ ИЗМЕНЕНИЯХ */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.2} />
        <div>
          <b>Транспорт, даты и фрахт</b> теперь редактируются в карточке рейса:
          <br />• Машина, водитель, даты — в блоке <b>«Участки»</b> (кнопка «Добавить участок»).
          <br />• Фрахт — в блоке <b>«Грузы»</b> (кнопка «Изменить» у груза).
          <br />Здесь вы можете изменить только данные заявки.
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Заявка клиента
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label className={labelClass}>Клиент</label>
            <select name="client_id" defaultValue={trip.client_id || ''} className={inputClass}>
              <option value="">Выберите клиента...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Номер заявки</label>
            <input type="text" name="client_request_number" defaultValue={trip.client_request_number || ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Дата заявки</label>
            <input type="date" name="client_request_date" defaultValue={trip.client_request_date || ''} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <FileText className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
          Технические данные
        </h2>
        <div>
          <label className={labelClass}>Остаток топлива (л)</label>
          <input type="number" name="start_fuel_level" step="0.01" defaultValue={trip.start_fuel_level || 0} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                      bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                      -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                      border-t sm:border-0 border-slate-200">
        <a
          href={`/trips/${tripId}`}
          className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-100 transition-all duration-150"
        >
          Отмена
        </a>
        <SubmitButton
          className="w-full sm:flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
          pendingText="Сохраняю изменения…"
        >
          Сохранить изменения
        </SubmitButton>
      </div>

    </form>
  );
}
