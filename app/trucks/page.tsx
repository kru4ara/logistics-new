import { supabase } from '../../lib/supabaseClient';

export default async function TrucksPage() {
  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*');

  if (error) {
    return <div>Ошибка: {error.message}</div>;
  }

  // Функция для подсчёта дней до даты
  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Список машин</h1>
        <a href="/trucks/new" style={{ backgroundColor: '#0070f3', color: 'white', padding: '10px 20px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}>+ Добавить машину</a>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th>Регистрация</th>
            <th>Тип</th>
            <th>Страховка до</th>
            <th>Техосмотр до</th>
            <th>Осталось дней</th>
          </tr>
        </thead>
        <tbody>
          {trucks?.map((truck) => {
            const daysLeft = getDaysUntil(truck.insurance_expiry);
            return (
              <tr key={truck.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{truck.registration_number}</td>
                <td style={{ padding: '10px' }}>
                  {truck.type === 'tractor' ? 'Тягач' : truck.type === 'trailer' ? 'Прицеп' : truck.type}
                </td>
                <td style={{ padding: '10px' }}>{truck.insurance_expiry || '-'}</td>
                <td style={{ padding: '10px' }}>{truck.tech_inspection_expiry || '-'}</td>
                <td style={{ padding: '10px' }}>
                  {daysLeft !== null ? (
                    <span style={{ color: daysLeft < 30 ? 'red' : 'green', fontWeight: 'bold' }}>
                      {daysLeft} дн.
                    </span>
                  ) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}