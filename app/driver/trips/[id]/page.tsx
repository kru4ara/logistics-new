import { supabase } from '../../../../lib/supabaseClient';
import { addExpense, deleteExpense } from '../../../trip-actions';
import FileUpload from '../../FileUpload';
import TripStatusButtons from '../../TripStatusButtons';

export default async function DriverTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  
  if (!tripId) {
    return <div>Ошибка: ID рейса не передан</div>;
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('id', tripId)
    .single();

  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documents, error: docError } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId);

  if (tripError || expError || docError) {
    return <div>Ошибка загрузки: {tripError?.message || expError?.message || docError?.message}</div>;
  }

  // Расчет остатка топлива (только для отображения, не для ввода)
  const refuelLiters = expenses?.filter(e => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Рейс №{trip.trip_number || '—'}</h1>
        <a href="/driver" style={{ color: '#0070f3' }}>← Все рейсы</a>
      </div>

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
        <p><strong>Клиент:</strong> {trip.clients?.name || 'Не указан'}</p>
        <p><strong>Маршрут:</strong> {trip.route || '-'}</p>
        <p><strong>Статус:</strong> {trip.status}</p>
        <p><strong>Дата старта:</strong> {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : '-'}</p>
      </div>

      {/* Кнопки статусов */}
      <div style={{ marginTop: '25px' }}>
        <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={false} />
      </div>

      {/* Остаток топлива (только информация) */}
      <div style={{ marginTop: '25px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>⛽ Остаток топлива</h3>
        <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#0070f3' }}>
          {fuelLeft.toFixed(1)} л
        </p>
      </div>

      {/* Загрузка документов */}
      <div style={{ marginTop: '25px' }}>
        <h2>Загрузка документов</h2>
        <FileUpload tripId={tripId} />
      </div>

      {/* Загруженные документы */}
      <div style={{ marginTop: '25px' }}>
        <h2>Загруженные документы</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Название</th>
              <th style={{ padding: '10px' }}>Тип</th>
              <th style={{ padding: '10px' }}>Дата загрузки</th>
            </tr>
          </thead>
          <tbody>
            {documents?.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет загруженных документов</td></tr>
            ) : (
              documents?.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{doc.original_name}</td>
                  <td style={{ padding: '10px' }}>{doc.document_type === 'cmr' ? '📄 CMR' : doc.document_type}</td>
                  <td style={{ padding: '10px' }}>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Расходы */}
      <div style={{ marginTop: '25px' }}>
        <h2>Расходы по рейсу</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Категория</th>
              <th style={{ padding: '10px' }}>Сумма (€)</th>
              <th style={{ padding: '10px' }}>Валюта</th>
              <th style={{ padding: '10px' }}>Литры</th>
              <th style={{ padding: '10px' }}>Описание</th>
              <th style={{ padding: '10px' }}>Дата</th>
              <th style={{ padding: '10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses?.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет расходов</td></tr>
            ) : (
              expenses?.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>
                    {exp.category === 'fuel' ? '⛽ Топливо' :
                     exp.category === 'epi' ? '📄 EPI' :
                     exp.category === 'etoll' ? '🛣 e-TOLL' :
                     exp.category === 'border' ? '🛂 Граница' :
                     exp.category === 'salary' ? '💶 ЗП водителя' :
                     exp.category === 'contractor' ? '🚛 Подрядчик' : exp.category}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{exp.amount_eur} €</td>
                  <td style={{ padding: '10px' }}>{exp.currency || 'EUR'}</td>
                  <td style={{ padding: '10px' }}>{exp.liters || '-'}</td>
                  <td style={{ padding: '10px' }}>{exp.description || '-'}</td>
                  <td style={{ padding: '10px' }}>{exp.expense_date || '-'}</td>
                  <td style={{ padding: '10px' }}>
                    <form action={async () => {
                      'use server';
                      await deleteExpense(exp.id, tripId);
                    }}>
                      <button type="submit" style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Удалить</button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Форма добавления расхода */}
      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>+ Добавить расход</h3>
        <form action={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
          <input type="hidden" name="trip_id" value={tripId} />
          
          <div>
            <label>Категория</label>
            <select name="category" required style={{ width: '100%', padding: '8px' }}>
              <option value="fuel">Топливо</option>
              <option value="epi">EPI</option>
              <option value="etoll">e-TOLL</option>
              <option value="border">Граница</option>
              <option value="salary">ЗП водителя</option>
              <option value="contractor">Подрядчик</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <div>
            <label>Валюта</label>
            <select name="currency" style={{ width: '100%', padding: '8px' }}>
              <option value="EUR">EUR</option>
              <option value="PLN">PLN</option>
              <option value="BYN">BYN</option>
            </select>
          </div>

          <div>
            <label>Сумма</label>
            <input type="number" name="amount" step="0.01" required style={{ width: '100%', padding: '8px' }} />
          </div>

          <div>
            <label>Литры (для топлива)</label>
            <input type="number" name="liters" step="0.01" placeholder="Например, 150" style={{ width: '100%', padding: '8px' }} />
          </div>

          <div>
            <label>Описание</label>
            <input type="text" name="description" style={{ width: '100%', padding: '8px' }} />
          </div>

          <div>
            <label>Дата</label>
            <input type="date" name="expense_date" style={{ width: '100%', padding: '8px' }} />
          </div>

          <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Добавить расход</button>
        </form>
      </div>
    </main>
  );
}
