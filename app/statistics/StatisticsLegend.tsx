import { Sigma, Info, Briefcase, Ban } from 'lucide-react';

export default function StatisticsLegend() {
  return (
    <div className="card p-5 md:p-6">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Sigma className="w-4 h-4 text-brand-600" strokeWidth={2.2} />
        Как считается
      </h3>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">ДОХОД</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono">
              Фрахт рейсов + Доход экспедиций
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">ОПЕРАЦИОННЫЕ РАСХОДЫ</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono leading-relaxed">
              Прямые расходы рейсов<br/>
              + Подрядчики экспедиций<br/>
              + Доп. расходы экспедиций<br/>
              + Операционные фикс-косты
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 md:p-4 border border-emerald-100">
            <div className="font-semibold text-emerald-800 mb-1.5">ПРИБЫЛЬ (P&L)</div>
            <div className="text-emerald-700 text-xs md:text-sm font-mono">
              ДОХОД − ОПЕРАЦИОННЫЕ РАСХОДЫ
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-1.5">МАРЖА</div>
            <div className="text-slate-600 text-xs md:text-sm font-mono">
              ПРИБЫЛЬ ÷ ДОХОД × 100%
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-brand-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-brand-800 mb-2 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4" strokeWidth={2.2} />
              Правила отнесения
            </div>
            <ul className="text-brand-900 text-xs md:text-sm space-y-1.5">
              <li>• <b>Заказ (рейс)</b> → к месяцу финиша (или старта, если финиш пустой)</li>
              <li>• <b>Экспедиция</b> → к месяцу загрузки</li>
              <li>• <b>Годовые операционные</b> (ОС, техосмотр, страховки) → 1/12 на 12 месяцев</li>
              <li>• <b>Инвестиции</b> → <b>вне P&L</b>, отдельный блок</li>
            </ul>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 md:p-4 border border-amber-200">
            <div className="font-semibold text-amber-800 mb-2 text-sm flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" strokeWidth={2.2} />
              Инвестиции (вне P&L)
            </div>
            <p className="text-amber-900 text-xs md:text-sm">
              Покупки машин, прицепов, крупное оборудование. Не вычитаются из операционной прибыли.
              Показываются отдельным блоком под итогами года.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 md:p-4">
            <div className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
              <Ban className="w-4 h-4" strokeWidth={2.2} />
              Не учитываются
            </div>
            <p className="text-slate-600 text-xs md:text-sm">
              Заказы без даты старта и финиша (черновики) в статистику не попадают.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
