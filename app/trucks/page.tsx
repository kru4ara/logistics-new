import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default async function TrucksPage() {
  const { data: trucks, error } = await supabase
    .from('trucks')
    .select('*');

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  // Получаем все рейсы, чтобы рассчитать остаток по каждой машине
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('truck_id, start_fuel_level, actual_liters, id')
    .order('trip_number', { ascending: false });

  if (tripsError) {
    return <div>Ошибка загрузки рейсов: {tripsError.message}</div>;
  }

  // Получаем все заправки (литры) из расходов
  const { data: fuelExpenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('trip_id, liters')
    .eq('category', 'fuel');

  if (expensesError) {
    return <div>Ошибка загрузки расходов: {expensesError.message}</div>;
  }

  // Строим карту: для каждой машины берём последний рейс и его остаток
  const fuelMap: Record<string, number> = {};
  const tripFuelMap: Record<string, number> = {};

  // Считаем заправки по каждому рейсу
  fuelExpenses?.forEach(exp => {
    if (exp.trip_id && exp.liters) {
      tripFuelMap[exp.trip_id] = (tripFuelMap[exp.trip_id] || 0) + exp.liters;
    }
  });

  // Проходим по рейсам (от новых к старым)
  trips?.forEach(trip => {
    if (!trip.truck_id) return;
    if (fuelMap[trip.truck_id] !== undefined) return; // уже нашли последний

    const refuel = tripFuelMap[trip.id] || 0;
    const fuelLeft = (trip.start_fuel_level || 0) + refuel - (trip.actual_liters || 0);
    fuelMap[trip.truck_id] = fuelLeft;
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
              <p><strong>Остаток в баке:</strong> {fuelMap[truck.id] !== undefined ? `${fuelMap[truck.id].toFixed(1)} л` : 'Нет данных'}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
