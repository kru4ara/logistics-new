import { Download, AlertTriangle } from 'lucide-react';

export default function DriverCardDownload({
  driver,
  driverCardBadge,
  DRIVER_CARD_PERIOD,
  DRIVER_CARD_WARN,
}: {
  driver: any;
  driverCardBadge: { color: string; label: string; daysAgo: number | null };
  DRIVER_CARD_PERIOD: number;
  DRIVER_CARD_WARN: number;
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Считывание карты водителя
        </h2>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${driverCardBadge.color}`}>
          {driverCardBadge.label}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
            Последнее считывание
          </div>
          <div className="text-slate-800 font-medium tabular-nums">
            {driver.driver_card_last_download
              ? new Date(driver.driver_card_last_download).toLocaleDateString('ru-RU')
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
            Лимит
          </div>
          <div className="text-slate-800 font-medium tabular-nums">
            {DRIVER_CARD_PERIOD} дн. (предупреждение с {DRIVER_CARD_WARN})
          </div>
        </div>
      </div>

      {driverCardBadge.daysAgo === null && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          💡 Дата последнего считывания не указана. Внесите её через <b>«Редактировать»</b>.
        </div>
      )}

      {driverCardBadge.daysAgo !== null && driverCardBadge.daysAgo > DRIVER_CARD_PERIOD && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
          <span>
            <b>Просрочено!</b> Карту водителя нужно считывать не реже <b>{DRIVER_CARD_PERIOD} дней</b> —
            иначе данные тахографа перезаписываются и теряются. Считайте как можно скорее.
          </span>
        </div>
      )}
    </div>
  );
}
