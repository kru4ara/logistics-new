'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Info,
  type LucideIcon,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastConfig = {
  type: ToastType;
  text: string;
};

// ============================================================
// Словарь сообщений: ключ в URL → текст
// ============================================================
const MESSAGES: Record<string, ToastConfig> = {
  // Общее
  saved: { type: 'success', text: 'Сохранено' },
  created: { type: 'success', text: 'Создано' },
  updated: { type: 'success', text: 'Изменения сохранены' },
  deleted: { type: 'success', text: 'Удалено' },

  // Рейсы
  trip_created: { type: 'success', text: 'Рейс создан' },
  trip_updated: { type: 'success', text: 'Рейс обновлён' },
  trip_deleted: { type: 'success', text: 'Рейс удалён' },

  // Клиенты
  client_created: { type: 'success', text: 'Клиент добавлен' },
  client_updated: { type: 'success', text: 'Клиент обновлён' },
  client_deleted: { type: 'success', text: 'Клиент удалён' },

  // Водители
  driver_created: { type: 'success', text: 'Водитель добавлен' },
  driver_updated: { type: 'success', text: 'Водитель обновлён' },
  driver_deleted: { type: 'success', text: 'Водитель удалён' },

  // Подрядчики
  contractor_created: { type: 'success', text: 'Подрядчик добавлен' },
  contractor_updated: { type: 'success', text: 'Подрядчик обновлён' },
  contractor_deleted: { type: 'success', text: 'Подрядчик удалён' },

  // Локации
  location_created: { type: 'success', text: 'Локация добавлена' },
  location_updated: { type: 'success', text: 'Локация обновлена' },
  location_deleted: { type: 'success', text: 'Локация удалена' },

  // Экспедирование
  forwarding_created: { type: 'success', text: 'Заявка создана' },
  forwarding_updated: { type: 'success', text: 'Заявка обновлена' },
  forwarding_deleted: { type: 'success', text: 'Заявка удалена' },

  // Расходы
  expense_added: { type: 'success', text: 'Расход добавлен' },
  expense_deleted: { type: 'success', text: 'Расход удалён' },

  // Телеметрия
  telemetry_saved: { type: 'success', text: 'Телеметрия сохранена' },

  // Документы
  document_uploaded: { type: 'success', text: 'Документ загружен' },

  // Напоминания
  reminder_created: { type: 'success', text: 'Напоминание создано' },
  reminder_updated: { type: 'success', text: 'Напоминание обновлено' },
  reminder_deleted: { type: 'success', text: 'Напоминание удалено' },
  reminder_done: { type: 'success', text: 'Отмечено как выполнено' },
  reminder_reopened: { type: 'info', text: 'Напоминание возвращено в работу' },

  // Общие ошибки
  error: { type: 'error', text: 'Что-то пошло не так' },
};

const TYPE_META: Record<ToastType, {
  Icon: LucideIcon;
  bg: string;
}> = {
  success: {
    Icon: CheckCircle2,
    bg: 'bg-emerald-600',
  },
  error: {
    Icon: XCircle,
    bg: 'bg-red-600',
  },
  info: {
    Icon: Info,
    bg: 'bg-ink-800',
  },
};

function buildMessage(key: string | null, customMsg: string | null): ToastConfig | null {
  if (!key) return null;
  if (key === 'error') {
    return {
      type: 'error',
      text: customMsg || 'Что-то пошло не так',
    };
  }
  return MESSAGES[key] ?? null;
}

export default function Toaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const toastKey = searchParams.get('toast');
  const errorMsg = searchParams.get('msg');

  const [visible, setVisible] = useState<ToastConfig | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const msg = buildMessage(toastKey, errorMsg);
    if (!msg) return;

    setVisible(msg);
    setKey((k) => k + 1);

    const hideTimer = setTimeout(() => {
      setVisible(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('toast');
      params.delete('msg');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 3000);

    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastKey, errorMsg]);

  if (!visible) return null;

  const meta = TYPE_META[visible.type];
  const Icon = meta.Icon;

  return (
    <div
      key={key}
      className="fixed top-4 right-4 z-[100] max-w-[380px] pointer-events-none animate-slide-down"
      role="status"
      aria-live="polite"
    >
      <div className={`${meta.bg} text-white rounded-xl px-4 py-3 shadow-2xl font-medium text-sm
                       flex items-start gap-2.5`}>
        <Icon className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
        <span>{visible.text}</span>
      </div>
    </div>
  );
}
