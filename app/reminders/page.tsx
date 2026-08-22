import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Функция, которая подсчитывает дни до даты
function getDaysUntil(dateString: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const targetDate = new Date(dateString);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default async function RemindersPage() {
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">⏰ Напоминания</h1>
          <Button asChild>
            <a href="/reminders/new">+ Добавить напоминание</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Сроки истекли</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {reminders?.filter(r => getDaysUntil(r.due_date) !== null && getDaysUntil(r.due_date) < 0).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Просрочено (0-30 дней)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {reminders?.filter(r => getDaysUntil(r.due_date) !== null && getDaysUntil(r.due_date) >= 0 && getDaysUntil(r.due_date) < 30).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Сроки в порядке</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {reminders?.filter(r => getDaysUntil(r.due_date) !== null && getDaysUntil(r.due_date) >= 30).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px' }}>Напоминание</th>
              <th style={{ padding: '10px' }}>Категория</th>
              <th style={{ padding: '10px' }}>Дата</th>
              <th style={{ padding: '10px' }}>Осталось дней</th>
              <th style={{ padding: '10px' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {reminders?.map((r) => {
              const daysLeft = getDaysUntil(r.due_date);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{r.title}</td>
                  <td style={{ padding: '10px' }}>
                    {r.category === 'insurance' ? '🚗 Страховка' :
                     r.category === 'inspection' ? '🔧 Техосмотр' :
                     r.category === 'driver_doc' ? '📄 Документы водителя' :
                     r.category === 'payment_to_contractor' ? '🚛 Подрядчик' :
                     r.category === 'accounting' ? '💰 Бухгалтерия' : r.category}
                  </td>
                  <td style={{ padding: '10px' }}>{r.due_date || '-'}</td>
                  <td style={{ padding: '10px' }}>
                    {daysLeft !== null ? (
                      <span style={{ 
                        color: daysLeft < 0 ? 'red' : daysLeft < 30 ? 'orange' : 'green',
                        fontWeight: 'bold'
                      }}>
                        {daysLeft} дн.
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      backgroundColor: 
                        daysLeft !== null && daysLeft < 0 ? '#fee2e2' :
                        daysLeft !== null && daysLeft < 30 ? '#ffedd5' : '#dcfce7'
                    }}>
                      {daysLeft !== null && daysLeft < 0 ? '⚠️ Истекло' :
                       daysLeft !== null && daysLeft < 30 ? '⚡ Скоро' : '✅ В порядке'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
