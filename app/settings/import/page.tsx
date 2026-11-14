import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { getSessionContext } from '../../../lib/session';
import { deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { IMPORT_SPECS, IMPORT_TYPES } from '../../../lib/import-rules';
import ImportCard from './ImportCard';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'settings.edit');
  if (denied) redirect(denied);
  const { t } = await getT();

  // Подписи колонок для сообщений об ошибках: поле → «Имя».
  const labels: Record<string, string> = {};
  for (const type of IMPORT_TYPES) for (const c of IMPORT_SPECS[type]) labels[c.field] = t(`imp.col_${c.field}` as never);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <Link href="/settings" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('nav.settings')}
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <FileSpreadsheet className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('imp.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">{t('imp.hint')}</p>
        </div>
        {IMPORT_TYPES.map((type) => (
          <ImportCard key={type} type={type} labels={labels} />
        ))}
      </div>
    </main>
  );
}
