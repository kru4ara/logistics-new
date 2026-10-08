import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import NewTruckForm from './NewTruckForm';

export const dynamic = 'force-dynamic';

export default function NewTruckPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/trucks"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          ← Все машины
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">➕ Добавить машину</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Заполните данные о технике
          </p>
        </div>

        <NewTruckForm />

      </div>
    </main>
  );
}
