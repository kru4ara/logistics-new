import { supabase } from '../../lib/supabaseClient';

export default async function FixedCostsPage() {
  const { data: costs, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('month_key', { ascending: false });

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <h1 style={{ fontSize: '24px' }}>Фиксированные затраты</h1>
  <a 
    href="/fixed-costs/new" 
    style={{ 
      backgroundColor: '#0070f3', 
      color: 'white', 
      padding: '10px 20px', 
      borderRadius: '5px', 
      textDecoration: 'none', 
      fontWeight: 'bold' 
    }}
  >
    + Добавить расход
  </a>
</div>
      
      <div style={{ marginTop: '20px' }}>
        <p style={{ color: '#666' }}>Здесь ты добавляешь ежемесячные расходы (страховки, бухгалтерия, Logisat).</p>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Месяц</th>
              <th style={{ padding: '10px' }}>Категория</th>
              <th style={{ padding: '10px' }}>Сумма (PLN)</th>
              <th style={{ padding: '10px' }}>Сумма (EUR)</th>
            </tr>
          </thead>
          <tbody>
            {costs?.map((cost) => (
              <tr key={cost.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{cost.month_key}</td>
                <td style={{ padding: '10px' }}>{cost.category}</td>
                <td style={{ padding: '10px' }}>{cost.amount_pln ? `${cost.amount_pln} PLN` : '-'}</td>
                <td style={{ padding: '10px' }}>{cost.amount_eur ? `${cost.amount_eur} €` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}