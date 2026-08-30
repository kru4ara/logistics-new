import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function FixedCostsPage() {
  const { data: costs, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('month_key', { ascending: false });

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">💰 Фиксированные затраты</h1>
          <Button asChild>
            <a href="/fixed-costs/new">+ Добавить затрату</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Топ-затрата</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {costs?.reduce((sum, c) => sum + (c.amount_eur || 0), 0) || 0} €
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Расходы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {costs?.reduce((sum, c) => sum + (c.amount_pln || 0), 0) || 0} PLN
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Всего фиксированных затрат</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {costs?.reduce((sum, c) => sum + (c.amount_eur || 0), 0) || 0} €
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Список затрат</h2>
          <table style={{ width: '100%', marginTop: '15px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px' }}>Месяц</th>
                <th style={{ padding: '10px' }}>Категория</th>
                <th style={{ padding: '10px' }}>Сумма (PLN)</th>
                <th style={{ padding: '10px' }}>Сумма (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {costs?.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{c.month_key}</td>
                  <td style={{ padding: '10px' }}>{c.category}</td>
                  <td style={{ padding: '10px' }}>{c.amount_pln ? `${c.amount_pln} PLN` : '-'}</td>
                  <td style={{ padding: '10px' }}>{c.amount_eur ? `${c.amount_eur} €` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
