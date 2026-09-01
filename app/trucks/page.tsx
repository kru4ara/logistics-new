import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default async function TrucksPage() {
  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*');

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  // Получаем последний рейс для каждого грузовика
  const { data: latestTrips } = await supabase
    .from('trips')
    .select('truck_id, actual_liters, start_fuel_level')
    .order('created_at', { ascending: false });

  // Группируем по truck_id (берем последний рейс)
  const fuelMap: Record<string, number> = {};
  latestTrips?.forEach(trip => {
    if (!fuelMap[trip.truck_id] && trip.truck_id) {
      // Вычисляем остаток: старт + заправки - расход (упрощенно пока без заправок, т.к. они в расходах)
      fuelMap[trip.truck_id] = (trip.start_fuel_level || 0) - (trip.actual_liters || 0);
    }
  });

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
              <p><strong>Остаток в баке:</strong> {fuelMap[truck.id] ? `${fuelMap[truck.id].toFixed(1)} л` : 'Нет данных'}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
