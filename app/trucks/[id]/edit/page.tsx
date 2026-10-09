import { createClient } from '../../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import EditTruckForm from './EditTruckForm';
import { ArrowLeft, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;

  const supabase = await createClient();

  const { data: truck, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (error || !truck) {
    return <div className="p-8 text-red-500">Машина не найдена</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href={`/trucks/${truckId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Назад к карточке
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать машину
          </h1>
        </div>

        <EditTruckForm truck={truck} />

      </div>
    </main>
  );
}
