import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import ExportForm from './ExportForm';
import { deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function ExcelExportPage() {
  const { t } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'export.view');
  if (denied) redirect(denied);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          {t('rep.backReports')}
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('rep.xlTitle')}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {t('rep.xlHint')}
          </p>
        </div>

        <ExportForm />

      </div>
    </main>
  );
}
