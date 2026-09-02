import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default async function TrucksPage() {
  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*');

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚚 Машины</h1>
          <Button asChild>
            <a href="/trucks/new">+ Добавить машину</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {trucks?.map((truck) => (
            <div key={truck.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p><strong>Госномер:</strong> {truck.registration_number}</p>
              <p><strong>Тип:</strong> {truck.type === 'tractor' ? 'Тягач' : truck.type === 'trailer' ? 'Прицеп' : truck.type}</p>
              <p><strong>Страховка:</strong> {truck.truck_insurance_expiry ? new Date(truck.truck_insurance_expiry).toLocaleDateString('ru-RU') : '-'}</p>
              <p><strong>Техосмотр:</strong> {truck.tech_inspection_expiry ? new Date(truck.tech_inspection_expiry).toLocaleDateString('ru-RU') : '-'}</p>
              {/* Добавляем ссылку на карточку */}
              <a href={`/trucks/${truck.id}`} style={{ color: '#0070f3', textDecoration: 'underline', marginTop: '10px', display: 'inline-block' }}>
                Профиль
              </a>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
