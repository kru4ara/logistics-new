import { createClient } from '../../../lib/supabase/admin';
import { scopedClient } from '../../../lib/supabase/scoped';
import CountryFlag from '../../../app/components/CountryFlag';
import { getT } from '../../../lib/i18n/server';
import { tPlural } from '../../../lib/i18n/translate';

export const dynamic = 'force-dynamic';

type ContractorRow = {
  id: string;
  name: string;
  full_name: string | null;
  country: string | null;
};

type FwdStatsRow = {
  contractor_id: string | null;
  price: number | null;
  contractor_payment_days: number | null;
};

type TripStatsRow = {
  contractor_id: string | null;
  price: number | null;
  currency: string | null;
};

type ContractorStat = {
  id: string;
  name: string;
  country: string | null;
  fwdCount: number;
  fwdSum: number;
  tripCount: number;
  tripSum: number;
  totalSum: number;
  totalCount: number;
  paymentDays: number | null;
};

function fmtEur(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtEurExact(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default async function ContractorsStatsPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const scoped = await scopedClient();

  // 1. Все подрядчики
  const { data: contractors, error: cErr } = await supabase
    .from('contractors')
    .select('id, name, full_name, country')
    .order('name');

  if (cErr) {
    return <div className="p-8 text-red-500">{t('dir.loadError')}{' '}{cErr.message}</div>;
  }

  // 2. Данные экспедирования — сегменты-подрядчики заказов
  //    в режиме forwarding (trips.profit_mode='forwarding').
  const { data: fwdRows } = await scoped
    .from('trip_segments')
    .select('contractor_id, price, contractor_payment_days, trips!inner(profit_mode)')
    .eq('executor_type', 'contractor')
    .eq('trips.profit_mode', 'forwarding');

  // 3. Данные комбинированных перевозок — участки-подрядчики в рейсах
  const { data: tripRows } = await scoped
    .from('trip_segments')
    .select('contractor_id, price, currency')
    .eq('executor_type', 'contractor')
    .not('contractor_id', 'is', null);

  // 4. Собираем статистику
  const statsMap = new Map<string, ContractorStat>();

  for (const c of (contractors || []) as ContractorRow[]) {
    statsMap.set(c.id, {
      id: c.id,
      name: c.name,
      country: c.country,
      fwdCount: 0,
      fwdSum: 0,
      tripCount: 0,
      tripSum: 0,
      totalSum: 0,
      totalCount: 0,
      paymentDays: null,
    });
  }

  const fwdRowsTyped = ((fwdRows || []) as FwdStatsRow[]).filter(
    (r) => (r as any).trips?.profit_mode === 'forwarding'
  );

  for (const r of fwdRowsTyped) {
    if (!r.contractor_id) continue;
    const s = statsMap.get(r.contractor_id);
    if (!s) continue;
    s.fwdCount += 1;
    s.fwdSum += Number(r.price) || 0;
  }

  for (const r of (tripRows || []) as TripStatsRow[]) {
    if (!r.contractor_id) continue;
    const s = statsMap.get(r.contractor_id);
    if (!s) continue;
    s.tripCount += 1;
    s.tripSum += Number(r.price) || 0;
  }

  // Итоги и средний срок оплаты
  for (const s of statsMap.values()) {
    s.totalSum = s.fwdSum + s.tripSum;
    s.totalCount = s.fwdCount + s.tripCount;
    // Средний срок оплаты считаем по экспедированию (там есть payment_days)
    const fwdPays = fwdRowsTyped.filter(
      (r) => r.contractor_id === s.id && r.contractor_payment_days
    );
    if (fwdPays.length > 0) {
      s.paymentDays = Math.round(
        fwdPays.reduce((sum, r) => sum + (r.contractor_payment_days || 0), 0) / fwdPays.length
      );
    }
  }

  const allStats = Array.from(statsMap.values());

  // Сортируем по общей сумме desc, потом по имени
  allStats.sort((a, b) => {
    if (b.totalSum !== a.totalSum) return b.totalSum - a.totalSum;
    return a.name.localeCompare(b.name, 'ru');
  });

  // Сводные метрики
  const totalContractors = allStats.length;
  const activeContractors = allStats.filter((s) => s.totalCount > 0).length;
  const grandTotal = allStats.reduce((sum, s) => sum + s.totalSum, 0);
  const grandCount = allStats.reduce((sum, s) => sum + s.totalCount, 0);

  // Топ-3
  const top3 = allStats.filter((s) => s.totalSum > 0).slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          {t('rep.allReports')}
        </a>

        {/* Заголовок */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl shrink-0">🚛</div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                {t('rep.ctrTitle')}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t('rep.ctrHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Сводка */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              {t('rep.ctrTotal')}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900">
              {totalContractors}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              {t('rep.ctrActive')}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600">
              {activeContractors}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {t('rep.ctrActiveHint')}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              {t('rep.ctrPaid')}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500">
              {fmtEur(grandTotal)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              {t('ctr.totalWorks')}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">
              {grandCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {t('rep.ctrPaidHint')}
            </div>
          </div>
        </div>

        {/* Топ-3 */}
        {top3.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {t('rep.top3')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {top3.map((s, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <a
                    key={s.id}
                    href={`/contractors/${s.id}`}
                    className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-amber-50/40 to-white
                               hover:border-amber-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-2xl">{medals[idx]}</span>
                      <span className="text-lg font-bold text-slate-900 break-words text-right">
                        {fmtEur(s.totalSum)}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 text-sm break-words">
                      {s.name}
                    </div>
                    {s.country && (
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <CountryFlag country={s.country} />
                        <span>{s.country}</span>
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-2">
                      {tPlural(t, locale, 'count3.job', s.totalCount)}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Полная таблица */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {t('rep.allCtr')}
          </h2>

          {/* Мобильная версия — карточки */}
          <div className="md:hidden space-y-3">
            {allStats.map((s) => {
              const isActive = s.totalCount > 0;
              return (
                <a
                  key={s.id}
                  href={`/contractors/${s.id}`}
                  className={`block border rounded-xl p-4 transition-all ${
                    isActive
                      ? 'border-slate-200 bg-slate-50/40 hover:border-blue-300'
                      : 'border-slate-100 bg-slate-50/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-sm break-words">
                        {s.name}
                      </div>
                      {s.country && (
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <CountryFlag country={s.country} />
                          <span>{s.country}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-base font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                        {isActive ? fmtEur(s.totalSum) : '—'}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                      <div>
                        <div className="text-slate-400">{t('rep.xlFwd')}</div>
                        <div className="text-slate-700 font-medium">
                          {s.fwdCount > 0
                            ? `${s.fwdCount} · ${fmtEur(s.fwdSum)}`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">{t('rep.combined')}</div>
                        <div className="text-slate-700 font-medium">
                          {s.tripCount > 0
                            ? `${s.tripCount} · ${fmtEur(s.tripSum)}`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* Десктоп — таблица */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('expenseCat.contractor')}
                  </th>
                  <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('addr.country')}
                  </th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('rep.xlFwd')}
                  </th>
                  <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('rep.sumFwd')}
                  </th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('rep.combinedS')}
                  </th>
                  <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('rep.sumComb')}
                  </th>
                  <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('rep.total')}
                  </th>
                  <th className="text-center py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('ctr.payment')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allStats.map((s) => {
                  const isActive = s.totalCount > 0;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-slate-50 transition-colors ${
                        isActive ? 'hover:bg-slate-50/60' : 'opacity-50'
                      }`}
                    >
                      <td className="py-3 text-sm">
                        <a
                          href={`/contractors/${s.id}`}
                          className="font-medium text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {s.name}
                        </a>
                      </td>
                      <td className="py-3 text-sm text-slate-500">
                        {s.country ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CountryFlag country={s.country} />
                            <span>{s.country}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 text-center text-sm text-slate-700">
                        {s.fwdCount > 0 ? s.fwdCount : '—'}
                      </td>
                      <td className="py-3 text-right text-sm text-slate-700">
                        {s.fwdSum > 0 ? fmtEur(s.fwdSum) : '—'}
                      </td>
                      <td className="py-3 text-center text-sm text-slate-700">
                        {s.tripCount > 0 ? s.tripCount : '—'}
                      </td>
                      <td className="py-3 text-right text-sm text-slate-700">
                        {s.tripSum > 0 ? fmtEur(s.tripSum) : '—'}
                      </td>
                      <td className="py-3 text-right text-sm font-bold text-red-500">
                        {isActive ? fmtEurExact(s.totalSum) : '—'}
                      </td>
                      <td className="py-3 text-center text-xs text-slate-500">
                        {s.paymentDays ? t('ctr.days', { n: s.paymentDays }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Итоги под таблицей */}
          {allStats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-between items-baseline gap-2 text-sm">
              <span className="text-slate-500">
                {t('rep.shown')}{' '}<b className="text-slate-700">{allStats.length}</b>{' '}{t('rep.ctrWithWorks')}{' '}<b className="text-slate-700">{activeContractors}</b>
              </span>
              <span className="text-slate-500">
                {t('rep.sumTotal')}{' '}<b className="text-red-500 text-base">{fmtEurExact(grandTotal)}</b>
              </span>
            </div>
          )}
        </div>

        {/* Подсказка */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💡</span>
            <div className="text-sm text-blue-900 space-y-1">
              <p>
                <b>{t('rep.sources')}</b>{' '}{t('rep.srcA')}<code className="text-xs bg-blue-100 px-1 rounded">trip_segments</code>{t('rep.srcWhere')}{' '}<code>executor_type = &apos;contractor&apos;</code>{' '}{t('rep.and')}
                <code>trips.profit_mode = &apos;forwarding&apos;</code>{t('rep.srcB')}<code className="text-xs bg-blue-100 px-1 rounded">trip_segments</code>{t('rep.srcWhere')}{' '}<code>executor_type = &apos;contractor&apos;</code>).
              </p>
              <p className="text-xs text-blue-700">
                {t('rep.srcC')}{' '}<code>price</code>{' '}{t('rep.srcD')}
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
