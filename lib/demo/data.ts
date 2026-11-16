/**
 * Демо-компания: правдоподобные данные «от сегодняшнего дня». Чистая функция —
 * тест lib/__tests__/demo-data.test.ts (связи, статусы, деньги). Записывает их
 * lib/demo/reset.ts. Все названия вымышленные.
 */

type Row = Record<string, unknown>;
export type DemoData = {
  company: Row;
  managers: Row[];
  clients: Row[];
  contractors: Row[];
  drivers: Row[];
  trucks: Row[];
  locations: Row[];
  trips: Row[];
  segments: Row[];
  cargo: Row[];
  expenses: Row[];
  documents: Row[];
  fixedCosts: Row[];
};

export const DEMO_CMR_PATH = 'demo/cmr-sample.pdf';

/** Предсказуемые id: d3m0…-<номер>. Одинаковые от сброса к сбросу — ссылки не ломаются. */
export const demoId = (kind: number, n: number) =>
  `d3300000-0000-4000-8${kind.toString(16).padStart(3, '0')}-${n.toString(16).padStart(12, '0')}`;

/** Детерминированный генератор (mulberry32): одинаковые данные при одинаковом зерне. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round = (n: number, step = 1) => Math.round(n / step) * step;

const CITIES: [string, string, string][] = [
  ['PL', 'Warszawa', '02-001'],
  ['PL', 'Poznań', '60-101'],
  ['PL', 'Łódź', '90-001'],
  ['DE', 'Berlin', '10115'],
  ['DE', 'Hamburg', '20095'],
  ['DE', 'München', '80331'],
  ['NL', 'Rotterdam', '3011'],
  ['BE', 'Antwerpen', '2000'],
  ['FR', 'Lyon', '69001'],
  ['AT', 'Wien', '1010'],
  ['CZ', 'Praha', '11000'],
  ['LT', 'Vilnius', '01100'],
  ['BY', 'Minsk', '220030'],
  ['IT', 'Milano', '20121'],
];

const CLIENTS = [
  ['Nordwind Handel GmbH', 'DE', 'Hamburg', 30],
  ['Baltic Fresh Sp. z o.o.', 'PL', 'Gdańsk', 21],
  ['Alpenland Logistik AG', 'AT', 'Wien', 45],
  ['Vistula Meble S.A.', 'PL', 'Poznań', 30],
  ['Rheinpaper GmbH', 'DE', 'Köln', 60],
  ['Benelux Parts B.V.', 'NL', 'Rotterdam', 30],
  ['Lumière Cosmetics SAS', 'FR', 'Lyon', 45],
  ['Minsk Agro Export', 'BY', 'Minsk', 14],
] as const;

const CONTRACTORS = [
  ['Trans-Kowal Jan Kowal', 'PL'],
  ['EuroRoute UAB', 'LT'],
  ['Szybki Kurs Sp. z o.o.', 'PL'],
  ['Danube Cargo s.r.o.', 'CZ'],
  ['Westlink Transport GmbH', 'DE'],
] as const;

const DRIVERS = [
  ['Andrzej', 'Nowicki'],
  ['Siarhei', 'Kavalenka'],
  ['Piotr', 'Zieliński'],
  ['Oleksandr', 'Bondar'],
  ['Marek', 'Wójcik'],
] as const;

const CARGO = ['Meble', 'Papier w rolkach', 'Części samochodowe', 'Kosmetyki', 'Żywność chłodzona', 'Opakowania', 'Sprzęt AGD'];

export function buildDemoData(todayIso: string, seed = 2026): DemoData {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const between = (lo: number, hi: number) => lo + r() * (hi - lo);
  const today = Date.parse(`${todayIso}T00:00:00Z`);

  const company = {
    id: 1,
    name: 'Demo Trans Sp. z o.o.',
    short_name: 'Demo Trans',
    address: 'ul. Przykładowa 1',
    city: '00-001 Warszawa',
    nip: '0000000000',
    regon: '000000000',
    bank: 'Bank Demo S.A.',
    account_eur: 'PL00 1020 0000 0000 0000 0000 0000',
    account_pln: 'PL00 1020 0000 0000 0000 0000 0001',
    email: 'biuro@demo-trans.example',
  };

  const managers = [
    { id: demoId(1, 1), full_name: 'Anna Lewandowska', email: 'manager@demo-trans.example', phone: '+48 600 000 001', active: true },
    { id: demoId(1, 2), full_name: 'Tomasz Mazur', email: 'tomasz@demo-trans.example', phone: '+48 600 000 002', active: true },
  ];

  const clients = CLIENTS.map(([name, country, city, days], i) => ({
    id: demoId(2, i + 1),
    name,
    country,
    city,
    payment_days: days,
    tax_id: country === 'PL' ? `PL${(1000000000 + i * 1111111).toString()}` : `${country}${(100000000 + i * 7654321).toString()}`,
    street: `Musterstraße ${i + 3}`,
    post_code: CITIES.find((c) => c[0] === country)?.[2] ?? '00000',
    contact_person: ['Jens', 'Ewa', 'Lukas', 'Marta', 'Klaus', 'Daan', 'Claire', 'Ivan'][i],
    email: `accounting@client${i + 1}.example`,
    mail_locale: country === 'PL' ? 'pl' : country === 'BY' ? 'ru' : 'en',
  }));

  const contractors = CONTRACTORS.map(([name, country], i) => ({
    id: demoId(3, i + 1),
    name,
    full_name: name,
    country,
    tax_id: `${country}${(500000000 + i * 3333333).toString()}`,
    contact_person: ['Jan', 'Tomas', 'Krzysztof', 'Pavel', 'Stefan'][i],
    email: `dispo@carrier${i + 1}.example`,
    phone: `+48 700 000 00${i + 1}`,
  }));

  const drivers = DRIVERS.map(([first, last], i) => ({
    id: demoId(4, i + 1),
    first_name: first,
    last_name: last,
    phone_pl: `+48 500 100 00${i + 1}`,
    email: `driver${i + 1}@demo-trans.example`,
    passport_expiry: iso(today + (i === 1 ? 20 : 400 + i * 60) * DAY), // одна — скоро истекает
    license_expiry: iso(today + (700 + i * 30) * DAY),
    code_95_expiry: iso(today + (i === 3 ? 12 : 500) * DAY),
  }));

  const tractors = [0, 1, 2, 3, 4].map((i) => ({
    id: demoId(5, i + 1),
    registration_number: `WX ${1001 + i}A`,
    type: 'tractor',
    brand: ['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz'][i],
    model: ['FH 500', 'R450', 'XF 480', 'TGX 18.470', 'Actros 1845'][i],
    year: 2019 + (i % 5),
    insurance_expiry: iso(today + (i === 2 ? 9 : 200 + i * 40) * DAY),
    tech_inspection_expiry: iso(today + (90 + i * 50) * DAY),
  }));
  const trailers = [0, 1, 2, 3, 4].map((i) => ({
    id: demoId(5, 100 + i + 1),
    registration_number: `WX ${7001 + i}N`,
    type: 'trailer',
    brand: ['Schmitz', 'Krone', 'Kögel', 'Schmitz', 'Wielton'][i],
    insurance_expiry: iso(today + (150 + i * 30) * DAY),
  }));
  const trucks = [...tractors, ...trailers];

  const locations = CITIES.slice(0, 10).map(([country, city, zip], i) => ({
    id: demoId(6, i + 1),
    name: `${city} — ${['Magazyn A', 'Lager Nord', 'DC Zuid', 'Entrepôt Est'][i % 4]}`,
    type: i % 3 === 0 ? 'both' : i % 2 === 0 ? 'loading' : 'unloading',
    country,
    city,
    postal_code: zip,
    company_name: ['LogiPark', 'WareHub', 'CargoCenter', 'Distri+'][i % 4],
    address: `Industriestr. ${10 + i}`,
  }));

  const trips: Row[] = [];
  const segments: Row[] = [];
  const cargo: Row[] = [];
  const expenses: Row[] = [];
  const documents: Row[] = [];

  const TRIP_COUNT = 72;
  for (let i = 0; i < TRIP_COUNT; i++) {
    const tripId = demoId(7, i + 1);
    const segId = demoId(8, i + 1);
    // Рейсы равномерно за ~150 дней; последние — в пути и запланированные.
    const startMs = today - (150 - i * 2.15) * DAY;
    const days = Math.round(between(2, 5));
    const endMs = startMs + days * DAY;
    const start = iso(startMs);
    const end = iso(endMs);
    const client = clients[Math.floor(r() * clients.length)];
    const [fromC, fromCity, fromZip] = pick(CITIES.filter((c) => c[0] === 'PL' || c[0] === 'LT' || c[0] === 'BY'));
    const [toC, toCity, toZip] = pick(CITIES.filter((c) => c[0] !== fromC));
    const own = r() < 0.7;
    const revenue = round(between(950, 3400), 50);
    const manager = r() < 0.45 ? managers[0].id : r() < 0.6 ? managers[1].id : null;
    const ageDays = (today - endMs) / DAY;

    let status: string;
    if (startMs > today) status = 'planned';
    else if (endMs > today) status = 'active';
    else if (ageDays < 10) status = 'completed';
    else if (ageDays < 50) status = r() < 0.75 ? 'invoiced' : 'paid';
    else status = r() < 0.9 ? 'paid' : 'invoiced'; // немного «старой» просрочки для дебиторки

    const invoiced = status === 'invoiced' || status === 'paid';
    const invoicedAt = iso(endMs + 2 * DAY);
    const due = iso(endMs + (2 + Number(client.payment_days)) * DAY);
    const paidAt = status === 'paid' ? iso(Math.min(today - DAY, endMs + (2 + Number(client.payment_days) + between(-5, 12)) * DAY)) : null;
    const d = new Date(endMs + 2 * DAY);

    const driver = drivers[i % drivers.length];
    const tractor = tractors[i % tractors.length];
    const trailer = trailers[i % trailers.length];
    const contractor = contractors[i % contractors.length];

    trips.push({
      id: tripId,
      client_id: client.id,
      manager_id: manager,
      status,
      start_date: `${start}T08:00:00`,
      end_date: status === 'planned' || status === 'active' ? null : `${end}T17:00:00`,
      load_date: start,
      unload_date: end,
      revenue_eur: revenue,
      client_request_number: `ZL/${d.getUTCFullYear()}/${String(1000 + i)}`,
      client_request_date: iso(startMs - 3 * DAY),
      profit_mode: own ? 'trip' : 'forwarding',
      driver_id: own ? driver.id : null,
      truck_id: own ? tractor.id : null,
      trailer_id: own ? trailer.id : null,
      actual_km: own && status !== 'planned' ? round(between(700, 1900)) : null,
      invoice_number: invoiced ? `FV ${i + 1}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : null,
      invoiced_at: invoiced ? invoicedAt : null,
      payment_due: invoiced ? due : null,
      paid_at: paidAt,
    });

    const price = own ? null : round(revenue * between(0.78, 0.9), 10);
    segments.push({
      id: segId,
      trip_id: tripId,
      position: 1,
      executor_type: own ? 'us' : 'contractor',
      contractor_id: own ? null : contractor.id,
      driver_id: own ? driver.id : null,
      truck_id: own ? tractor.id : null,
      trailer_id: own ? trailer.id : null,
      date_from: start,
      date_to: end,
      from_country: fromC,
      from_city: fromCity,
      from_postal_code: fromZip,
      to_country: toC,
      to_city: toCity,
      to_postal_code: toZip,
      price,
      currency: 'EUR',
      contractor_truck_number: own ? null : `LT ${100 + i}`,
      contractor_driver_name: own ? null : 'Kierowca przewoźnika',
    });

    cargo.push({
      id: demoId(9, i + 1),
      trip_id: tripId,
      position: 1,
      label: pick(CARGO),
      weight_kg: round(between(4000, 22000), 100),
      pallets: Math.round(between(10, 33)),
      client_id: client.id,
      from_country: fromC,
      from_city: fromCity,
      from_postal_code: fromZip,
      to_country: toC,
      to_city: toCity,
      to_postal_code: toZip,
      freight_amount: revenue,
      freight_currency: 'EUR',
    });

    if (status === 'planned') continue;
    let e = 0;
    const exp = (row: Row) => expenses.push({ id: demoId(10, i * 10 + ++e), trip_id: tripId, expense_date: start, currency: 'EUR', ...row });
    if (own) {
      const liters = round(between(250, 600));
      exp({ category: 'fuel', amount_eur: round(liters * 1.42, 0.01), original_amount: round(liters * 1.42, 0.01), liters, description: 'Tankowanie' });
      exp({ category: 'etoll', amount_eur: round(between(60, 240), 0.01), original_amount: null, description: 'Opłaty drogowe' });
      exp({ category: 'salary', amount_eur: round(days * 85, 0.01), original_amount: null, description: 'Dieta kierowcy' });
      if (r() < 0.2) exp({ category: 'parking', amount_eur: round(between(15, 40), 0.01), original_amount: null, description: 'Parking' });
    } else {
      exp({ category: 'contractor', amount_eur: price, original_amount: price, segment_id: segId, description: contractor.name });
    }

    // CMR: у выставленных и у большинства завершённых — для «К выставлению».
    const hasCmr = invoiced || (status === 'completed' && i % 4 !== 0);
    if (hasCmr) {
      documents.push({
        id: demoId(11, i + 1),
        trip_id: tripId,
        document_type: 'cmr',
        file_path: DEMO_CMR_PATH,
        original_name: `CMR_${i + 1}.pdf`,
        uploaded_at: `${iso(endMs + DAY)}T09:00:00Z`,
      });
    }
  }

  const fixedCosts: Row[] = [];
  for (let m = 0; m < 6; m++) {
    const d = new Date(today);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - m);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const rows: [string, number][] = [
      ['Biuro — czynsz', 1150],
      ['Księgowość', 420],
      ['Leasing ciągników', 6800],
      ['Ubezpieczenia OC/AC', 1900],
    ];
    rows.forEach(([category, eur], k) =>
      fixedCosts.push({
        id: demoId(12, m * 10 + k + 1),
        month_key: key,
        category,
        cost_type: 'monthly',
        currency: 'EUR',
        original_amount: eur,
        amount_eur: eur,
        expense_date: `${key}-05`,
        is_capex: false,
      }),
    );
  }

  return { company, managers, clients, contractors, drivers, trucks, locations, trips, segments, cargo, expenses, documents, fixedCosts };
}

/** Демо-учётки: вход на странице входа одной кнопкой (lib/demo/reset.ts заводит их). */
export const DEMO_ACCOUNTS = [
  { key: 'office', email: 'office@demo-trans.example', role: 'office', fullName: 'Biuro Demo' },
  { key: 'accountant', email: 'ksiegowosc@demo-trans.example', role: 'accountant', fullName: 'Księgowa Demo' },
  { key: 'manager', email: 'manager@demo-trans.example', role: 'manager', fullName: 'Anna Lewandowska', managerId: demoId(1, 1) },
  { key: 'driver', email: 'driver1@demo-trans.example', role: 'driver', fullName: 'Andrzej Nowicki', driverId: demoId(4, 1) },
] as const;
export type DemoAccountKey = (typeof DEMO_ACCOUNTS)[number]['key'];
