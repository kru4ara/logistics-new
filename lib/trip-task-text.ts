/**
 * Общий сборщик текста задачи водителю.
 * Используется и в `app/trips/[id]/page.tsx` (для показа/копирования),
 * и в `app/trips/[id]/task-actions.ts` (для отправки в Telegram).
 *
 * Логика:
 * - Если у рейса есть сегменты с executor_type='us' → показываем только их.
 * - Маршрут (шапка) — из крайних сегментов (from первого → to последнего).
 *
 * Legacy-поля trips (sender_*, receiver_*, route) НЕ используются.
 */

type DriverInfo = {
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;      // legacy, fallback
  phone_by?: string | null;   // ⬅️ НОВОЕ
  phone_pl?: string | null;   // ⬅️ НОВОЕ
} | null;

type TruckInfo = {
  registration_number: string | null;
} | null;

type CargoLink = {
  cargo_id: string;
  position: number;
  label: string;
};

type StopItem = {
  type: 'load' | 'reload' | 'unload';
  company: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  date: string | null;
};

type SegmentInfo = {
  id: string;
  position: number;
  executor_type: string;
  date_from: string | null;
  date_to: string | null;
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
  stops: StopItem[] | null;
  cargoLinks: CargoLink[];
};

type BuildTaskParams = {
  trip: any;
  driver: DriverInfo;
  truck: TruckInfo;
  trailerNumber: string | null;
  segments: SegmentInfo[];
  markdown?: boolean;
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

function fmtPlace(
  company: string | null,
  city: string | null,
  country: string | null,
  address?: string | null
): string {
  const parts = [company, city, country].filter(Boolean).join(', ');
  if (address) return parts ? `${parts} · ${address}` : address;
  return parts;
}

// ⬅️ ИЗМЕНЕНО: маршрут из сегментов (from первого → to последнего)
function buildRouteFromSegments(segments: SegmentInfo[]): string {
  if (!segments || segments.length === 0) return '—';
  const sorted = [...segments].sort((a, b) => (a.position || 0) - (b.position || 0));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const fromParts = [first.from_city, first.from_country].filter(Boolean);
  const toParts = [last.to_city, last.to_country].filter(Boolean);

  const from = fromParts.join(', ') || '—';
  const to = toParts.join(', ') || '—';
  return `${from} → ${to}`;
}

const STOP_LABEL: Record<StopItem['type'], string> = {
  load: 'Загрузка',
  reload: 'Догруз / перегруз',
  unload: 'Выгрузка',
};

export function buildDriverTaskText({
  trip,
  driver,
  truck,
  trailerNumber,
  segments,
  markdown = false,
}: BuildTaskParams): string {
  const b = (t: string) => (markdown ? `*${t}*` : t);
  const lines: string[] = [];

  // ============================================================
  // Шапка
  // ============================================================
  lines.push(`🚛 ${b(`Задание на рейс №${trip.trip_number || '—'}`)}`);
  lines.push('');

  if (trip.clients?.name) {
    lines.push(`${b('Клиент:')} ${trip.clients.name}`);
  }
  // ⬅️ ИЗМЕНЕНО: маршрут — из сегментов (fallback на trip.route удалён)
  lines.push(`${b('Маршрут:')} ${buildRouteFromSegments(segments)}`);
  if (trip.start_date) {
    lines.push(`${b('Старт:')} ${fmtDate(trip.start_date)}`);
  }

  const truckReg = truck?.registration_number || null;
  if (truckReg) {
    const tractorTrailer = trailerNumber ? `${truckReg} / ${trailerNumber}` : truckReg;
    lines.push('');
    lines.push(`🚚 ${b('Тягач:')} ${tractorTrailer}`);
  }

  lines.push('');

  // ============================================================
  // Основной блок: сегменты с executor_type='us'
  // ============================================================
  const usSegments = segments
    .filter((s) => s.executor_type === 'us')
    .sort((a, b) => a.position - b.position);

  if (usSegments.length > 0) {
    lines.push(`📍 ${b('ТВОЙ МАРШРУТ:')}`);
    lines.push('');

    usSegments.forEach((seg, segIdx) => {
      const isMulti = usSegments.length > 1;
      if (isMulti) {
        lines.push(b(`Участок ${segIdx + 1}:`));
      }

      // Даты сегмента
      if (seg.date_from || seg.date_to) {
        const dateParts: string[] = [];
        if (seg.date_from) dateParts.push(fmtDate(seg.date_from));
        if (seg.date_to) dateParts.push(fmtDate(seg.date_to));
        lines.push(`📅 ${dateParts.join(' → ')}`);
      }

      // Откуда
      const fromStr = fmtPlace(seg.from_company, seg.from_city, seg.from_country, seg.from_address);
      if (fromStr) lines.push(fromStr);

      // Промежуточные точки
      const stops = Array.isArray(seg.stops) ? seg.stops : [];
      for (const stop of stops) {
        const stopStr = fmtPlace(stop.company, stop.city, stop.country, stop.address);
        const label = STOP_LABEL[stop.type] || 'Остановка';
        const datePart = stop.date ? ` (${fmtDate(stop.date)})` : '';
        lines.push(`   ↓ ${label}${datePart}: ${stopStr}`);
      }

      // Куда
      const toStr = fmtPlace(seg.to_company, seg.to_city, seg.to_country, seg.to_address);
      if (toStr) lines.push(`→ ${toStr}`);

      // Грузы
      if (seg.cargoLinks.length > 0) {
        lines.push('');
        lines.push(b('Грузы:'));
        for (const cl of seg.cargoLinks) {
          const label = cl.label || '—';
          lines.push(`   #${cl.position} ${label}`);
        }
      }

      if (segIdx < usSegments.length - 1) {
        lines.push('');
      }
    });
  }
  // ⬅️ ИЗМЕНЕНО: fallback-блок sender_*/receiver_* удалён (Фаза 3.6.4)

  // ============================================================
  // Футер (для Telegram)
  // ============================================================
  if (markdown) {
    lines.push('');
    lines.push(`Открыть в приложении: https://logistics-new-ebon.vercel.app/driver/trips/${trip.id}`);
  }

  return lines.join('\n');
}
