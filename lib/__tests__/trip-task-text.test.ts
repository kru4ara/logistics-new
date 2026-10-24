import { describe, it, expect } from 'vitest';
import { buildDriverTaskText } from '../trip-task-text';

// Базовая «заготовка» рейса и сегмента, чтобы не дублировать код в каждом тесте
const baseTrip = {
  id: 'trip-1',
  trip_number: 42,
  clients: { name: 'ООО Ромашка' },
  start_date: '2026-05-10',
};

const baseSegment = {
  id: 'seg-1',
  position: 1,
  executor_type: 'us',
  date_from: '2026-05-10',
  date_to: '2026-05-12',
  truck_reg: 'А123ВС',
  trailer_reg: 'Е456КХ',
  from_country: 'Беларусь',
  from_city: 'Минск',
  from_company: 'Склад №1',
  from_address: 'ул. Ленина, 1',
  from_postal_code: '220000',
  to_country: 'Польша',
  to_city: 'Варшава',
  to_company: 'Магазин',
  to_address: 'ул. Пилсудского, 2',
  to_postal_code: '00-001',
  stops: [],
  cargoLinks: [],
};

describe('buildDriverTaskText', () => {
  it('формирует базовую шапку с номером рейса и клиентом', () => {
    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [],
    });

    expect(text).toContain('Задание на рейс №42');
    expect(text).toContain('Клиент: ООО Ромашка');
    expect(text).toContain('Старт: 10.05.2026');
  });

  it('строит маршрут из крайних сегментов (from первого, to последнего)', () => {
    const segments = [
      { ...baseSegment, id: 's1', position: 1, from_city: 'Минск', to_city: 'Брест' },
      { ...baseSegment, id: 's2', position: 2, from_city: 'Брест', to_city: 'Варшава' },
    ];

    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments,
    });

    expect(text).toContain('МАРШРУТ: Минск, Беларусь → Варшава, Польша');
  });

  it('показывает машину и прицеп', () => {
    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [baseSegment],
    });

    expect(text).toContain('Машина: А123ВС / Е456КХ');
  });

  it('добавляет промежуточные точки (stops)', () => {
    const segmentWithStop = {
      ...baseSegment,
      stops: [
        {
          type: 'reload' as const,
          company: 'ТЛЦ Брест',
          city: 'Брест',
          country: 'Беларусь',
          address: 'ул. Таможенная, 1',
          date: '2026-05-11',
        },
      ],
    };

    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [segmentWithStop],
    });

    expect(text).toContain('Догруз / перегруз (11.05.2026): ТЛЦ Брест, Брест, Беларусь · ул. Таможенная, 1');
  });

  it('выводит список грузов (#position label)', () => {
    const segmentWithCargo = {
      ...baseSegment,
      cargoLinks: [
        { cargo_id: 'c1', position: 1, label: 'Шоколад' },
        { cargo_id: 'c2', position: 2, label: 'Печенье' },
      ],
    };

    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [segmentWithCargo],
    });

    expect(text).toContain('Грузы:');
    expect(text).toContain('#1 Шоколад');
    expect(text).toContain('#2 Печенье');
  });

  it('игнорирует сегменты с executor_type != "us"', () => {
    const contractorSegment = {
      ...baseSegment,
      id: 's-contractor',
      executor_type: 'contractor', // <-- не наша машина
      truck_reg: 'XYZ',
      to_city: 'Берлин',
    };

    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [baseSegment, contractorSegment],
    });

    expect(text).toContain('МАРШРУТ: Минск, Беларусь → Варшава, Польша'); // только из us-сегмента
    expect(text).not.toContain('Берлин'); // игнорируем контрактора
  });

  it('добавляет ссылку в футере при markdown=true', () => {
    const text = buildDriverTaskText({
      trip: baseTrip,
      driver: null,
      truck: null,
      trailerNumber: null,
      segments: [baseSegment],
      markdown: true,
    });

    expect(text).toContain('https://logistics-new-ebon.vercel.app/driver/trips/trip-1');
  });
});
