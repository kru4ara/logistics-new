// Разбор связанных записей Supabase (один объект или массив) и имён.
// Вынесено из app/today/page.tsx (Фаза 40).

export function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

export type DriverRel = { first_name: string | null; last_name: string | null };
export type TruckRel = { registration_number: string | null };

export function getDriverName(rel: unknown): string | null {
  const d = pickOne<DriverRel>(rel);
  if (!d) return null;
  const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
  return name || null;
}

export function getTruckNumber(rel: unknown): string | null {
  const t = pickOne<TruckRel>(rel);
  return t?.registration_number || null;
}
