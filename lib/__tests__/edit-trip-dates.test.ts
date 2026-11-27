import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// trips.start_date / end_date — timestamp («2026-02-19T00:00:00»). Такое значение
// в <input type="date"> показывается пустым, и сохранение формы стирало даты
// заказа (27.11.2026: старые заказы «улетали» в новые). Сторож: в форму правки
// даты заказа идут только через dateInput().
describe('форма правки заказа', () => {
  it('не кладёт сырой timestamp в поле даты', () => {
    const src = readFileSync('app/trips/[id]/edit/EditTripForm.tsx', 'utf8');
    expect(src).not.toMatch(/defaultValue=\{trip\.(start|end)_date\b/);
    expect(src).toMatch(/defaultValue=\{dateInput\(trip\.start_date\)\}/);
    expect(src).toMatch(/defaultValue=\{dateInput\(trip\.end_date\)\}/);
  });
});
