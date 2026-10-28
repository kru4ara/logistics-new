import Link from 'next/link';
import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import NewTruckForm from './NewTruckForm';
import { ArrowLeft, Truck as TruckIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewTruckPage() {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/trucks"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все машины
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <TruckIcon className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Добавить машину
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Заполните данные о технике
          </p>
        </div>

        <NewTruckForm />

      </div>
    </main>
  );
}
