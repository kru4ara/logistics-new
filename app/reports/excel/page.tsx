import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ExportForm from './ExportForm';

export const dynamic = 'force-dynamic';

export default function ExcelExportPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          ← Отчёты
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📥 Экспорт в Excel</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Выберите, что выгрузить, укажите период и скачайте .xlsx-файл
          </p>
        </div>

        <ExportForm />

      </div>
    </main>
  );
}
