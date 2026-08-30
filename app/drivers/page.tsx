import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DriversPage() {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*');

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Водители</h1>
          <Button asChild>
            <a href="/drivers/new">+ Добавить водителя</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {drivers?.map((driver) => (
            <div key={driver.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p><strong>Имя:</strong> {driver.first_name}</p>
              <p><strong>Фамилия:</strong> {driver.last_name}</p>
              <p><strong>Телефон:</strong> {driver.phone || '-'}</p>
              <p><strong>Срок визы:</strong> {driver.visa_expiry || '-'}</p>
              <p><strong>Срок паспорта:</strong> {driver.passport_expiry || '-'}</p>
              <p><strong>Срок прав:</strong> {driver.license_expiry || '-'}</p>
              <p><strong>Срок карты тахографа:</strong> {driver.tachograph_card_expiry || '-'}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
