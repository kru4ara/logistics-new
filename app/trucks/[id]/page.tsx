import { createClient } from '../../../lib/supabase-server';
import DocumentUpload from '../../components/DocumentUpload';

export const dynamic = 'force-dynamic';

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;
  if (!truckId) return <div className="p-8">Ошибка: ID машины не передан</div>;

  const supabase = await createClient();

  const { data: truck, error: truckError } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (truckError) return <div className="p-8 text-red-500">Ошибка загрузки: {truckError.message}</div>;

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', 'truck')
    .eq('entity_id', truckId);

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function daysBadge(dateString: string | null) {
    const days = getDaysUntil(dateString);
    if (days === null) return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: '—' };
    if (days < 0) return { color: 'bg-red-50 text-red-700 border-red-200', label: `${days} дн.` };
    if (days < 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${days} дн.` };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${days} дн.` };
  }

  const typeLabel = truck.type === 'tractor' ? 'Тягач' : truck.type === 'trailer' ? 'Прицеп' : truck.type;
  const typeIcon = truck.type === 'tractor' ? '🚛' : truck.type === 'trailer' ? '🚚' : '🚗';

  const documentFields = [
    { label: 'Страховка ОС', value: truck.truck_insurance_expiry, icon: '🛡' },
    { label: 'Техосмотр', value: truck.tech_inspection_expiry, icon: '🔧' },
    { label: 'Пограничная страховка РБ', value: truck.border_insurance_expiry, icon: '🛂' },
    { label: 'Легализация тахографа', value: truck.tachograph_legalization_expiry, icon: '💳' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <a href="/trucks" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все машины
        </a>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700
                              flex items-center justify-center text-white text-4xl shrink-0">
                {typeIcon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {truck.registration_number}
                </h1>
                <p className="text-slate-500 mt-1">
                  {typeLabel}
                  {truck.trailer_number && ` · Прицеп: ${truck.trailer_number}`}
                </p>
              </div>
            </div>

            <a
              href={`/trucks/${truckId}/edit`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                         transition-all duration-150 active:scale-[0.98]"
            >
              ✏️ Редактировать
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Технические данные</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тип</div>
              <div className="text-slate-800 font-medium">{typeLabel}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Номер прицепа</div>
              <div className="text-slate-800 font-medium">{truck.trailer_number || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Топливная карта</div>
              <div className="text-slate-800 font-medium">{truck.fuel_card_number || '—'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📅 Сроки документов</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {documentFields.map((doc) => {
              const badge = daysBadge(doc.value);
              return (
                <div key={doc.label} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{doc.icon}</span>
                    <span className="text-sm font-semibold text-slate-700">{doc.label}</span>
                  </div>
                  <div className="text-slate-800 font-medium mb-2">
                    {doc.value ? new Date(doc.value).toLocaleDateString('ru-RU') : '—'}
                  </div>
                  <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Загруженные файлы</h2>
          {documents?.length === 0 ? (
            <div className="text-slate-400 text-center py-8">Файлы ещё не загружены</div>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{doc.document_type}</div>
                      <div className="text-xs text-slate-400">
                        {doc.expiry_date ? `до ${new Date(doc.expiry_date).toLocaleDateString('ru-RU')}` : 'без срока'}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                    target="_blank"
                    className="text-blue-600 hover:underline font-medium text-sm whitespace-nowrap"
                  >
                    Смотреть
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <DocumentUpload entityType="truck" entityId={truckId} />
        </div>

      </div>
    </main>
  );
}
