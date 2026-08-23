import { supabase } from '../../../../lib/supabaseClient';
import { addExpense } from '../../../trip-actions';
import { deleteExpense } from '../../../expense-actions';
import FileUpload from '../../FileUpload';

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

  if (tripError || expError) {
    return <div>Ошибка загрузки: {tripError?.message || expError?.message}</div>;
  }

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = (trip.revenue_eur || 0) - totalExpenses;

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Рейс #{tripId.slice(0, 8)}</h1>
        <a href="/driver" style={{ color: '#0070f3' }}>← Все рейсы</a>
      </div>

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
        <p><strong>Клиент:</strong> {trip.clients?.name || 'Не указан'}</p>
        <p><strong>Маршрут:</strong> {trip.route || '-'}</p>
        <p><strong>Статус:</strong> {trip.status}</p>
        <p><strong>Выручка:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : 'Не указана'}</p>
      </div>

      <div style={{ marginTop: '25px' }}>
        <h2>Загрузка документов</h2>
        <FileUpload tripId={tripId} />
      </div>

      <div style={{ marginTop: '25px' }}>
        <h2>Расходы по рейсу</h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Категория</th>
              <th style={{ padding: '10px' }}>Сумма (€)</th>
              <th style={{ padding: '10px' }}>Описание</th>
              <th style={{ padding: '10px' }}>Дата</th>
              <th style={{ padding: '10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses?.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет расходов</td></tr>
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
                  <td style={{ padding: '10px' }}>{exp.description || '-'}</td>
                  <td style={{ padding: '10px' }}>{exp.expense_date || '-'}</td>
                  <td style={{ padding: '10px' }}>
                    <form action={async () => {
                      'use server';
                      await deleteExpense(exp.id, tripId);
                    }}>
                      <button 
                        type="submit"
                        style={{ 
                          backgroundColor: '#ef4444', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️ Удалить
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '25px', padding: '15px', background: '#eef2ff', borderRadius: '8px' }}>
        <h3>Экономика рейса</h3>
        <p><strong>Выручка:</strong> {trip.revenue_eur || 0} €</p>
        <p><strong>Расходы:</strong> {totalExpenses.toFixed(2)} €</p>
        <p style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          color: profit >= 0 ? 'green' : 'red' 
        }}>
          <strong>Прибыль:</strong> {profit.toFixed(2)} €
        </p>
      </div>

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
            <label>Сумма (€)</label>
            <input type="number" name="amount_eur" step="0.01" required style={{ width: '100%', padding: '8px' }} />
          </div>

          <div>
            <label>Описание</label>
            <input type="text" name="description" style={{ width: '100%', padding: '8px' }} />
          </div>

          <div>
            <label>Дата</label>
            <input type="date" name="expense_date" style={{ width: '100%', padding: '8px' }} />
          </div>

          <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Добавить расход
          </button>
        </form>
      </div>
    </main>
  );
}
