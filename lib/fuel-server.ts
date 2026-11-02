import type { createClient } from './supabase/admin';
import {
  calculateFuelLevels,
  type FuelExpenseRow,
  type FuelLevel,
  type FuelTripRow,
} from './fuel';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Последний показатель остатка топлива по всем тягачам.
 *
 * Тянет рейсы с номером и заправки (расходы категории 'fuel'),
 * дальше считает остаток через calculateFuelLevels.
 */
export async function fetchFuelLevels(
  supabase: Supabase
): Promise<Map<string, FuelLevel>> {
  const { data: trips } = await supabase
    .from('trips')
    .select(
      'id, truck_id, trip_number, status, start_date, end_date, start_fuel_level, actual_liters'
    )
    .not('truck_id', 'is', null)
    .not('trip_number', 'is', null);

  const rows = (trips || []) as FuelTripRow[];
  const tripIds = rows.map((r) => r.id);

  const { data: expenses } = tripIds.length > 0
    ? await supabase
        .from('trip_expenses')
        .select('trip_id, liters')
        .eq('category', 'fuel')
        .in('trip_id', tripIds)
    : { data: [] };

  return calculateFuelLevels(rows, (expenses || []) as FuelExpenseRow[]);
}
