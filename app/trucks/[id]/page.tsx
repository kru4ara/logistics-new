import { supabase } from '../../../lib/supabaseClient';
import DocumentUpload from '../../components/DocumentUpload';

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;
  
  if (!truckId) return <div>Ошибка: ID машины не передан</div>;

  const { data: truck, error: truckError } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (truckError) return <div>Ошибка загрузки: {truckError.message}</div>;

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', 'truck')
    .eq('entity_id', truckId);

  if (docError) return <div>Ошибка загрузки документов: {docError.message}</div>;

  function getDaysLeft(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  const docsWithStatus = documents?.map(doc => ({
    ...doc,
    daysLeft: getDaysLeft(doc.expiry_date)
  })) || [];

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Карточка машины: {truck.registration_number}</h1>
        <a href="/trucks" style={{ color: '#0070f3' }}>← Все машины</a>
      </div>

      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginTop: '15px' }}>
        <h3 style={{ marginTop: 0 }}>Технические данные</h3>
        <p><strong>Тип:</strong> {truck.type === 'tractor' ? 'Тягач' : 'Прицеп'}</p>
        <p><strong>Номер прицепа:</strong> {truck.trailer_number || '-'}</p>
        <p><strong>Страховка ОС до:</strong> {truck.truck_insurance_expiry ? new Date(truck.truck_insurance_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Пограничная страховка до:</strong> {truck.border_insurance_expiry ? new Date(truck.border_insurance_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Техосмотр до:</strong> {truck.tech_inspection_expiry ? new Date(truck.tech_inspection_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Топливная карта:</strong> {truck.fuel_card_number || '-'}</p>
        <p><strong>Легализация тахографа до:</strong> {truck.tachograph_legalization_expiry ? new Date(truck.tachograph_legalization_expiry).toLocaleDateString('ru-RU') : '-'}</p>
      </div>

      <div style={{ marginTop: '25px' }}>
        <h2>📁 Документы</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Тип</th>
              <th style={{ padding: '10px' }}>Срок действия</th>
              <th style={{ padding: '10px' }}>Осталось дней</th>
              <th style={{ padding: '10px' }}>Файл</th>
            </tr>
          </thead>
          <tbody>
            {docsWithStatus.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет загруженных документов</td></tr>
            ) : (
              docsWithStatus.map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{doc.document_type}</td>
                  <td style={{ padding: '10px' }}>{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td style={{ padding: '10px' }}>
                    {doc.daysLeft !== null ? (
                      <span style={{ color: doc.daysLeft < 0 ? 'red' : doc.daysLeft < 30 ? 'orange' : 'green', fontWeight: 'bold' }}>
                        {doc.daysLeft} дн.
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`} target="_blank" style={{ color: '#0070f3' }}>Смотреть</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DocumentUpload entityType="truck" entityId={truckId} onUploaded={() => {}} />
    </main>
  );
}
