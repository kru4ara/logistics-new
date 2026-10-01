'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type ToastType = 'success' | 'error' | 'info';

type ToastConfig = {
  type: ToastType;
  text: string;
};

// ============================================================
// Словарь сообщений: ключ в URL → текст и стиль
// ============================================================
const MESSAGES: Record<string, ToastConfig> = {
  // Общее
  saved: { type: 'success', text: '✅ Сохранено' },
  created: { type: 'success', text: '✅ Создано' },
  updated: { type: 'success', text: '✅ Изменения сохранены' },
  deleted: { type: 'success', text: '🗑 Удалено' },

  // Рейсы
  trip_created: { type: 'success', text: '✅ Рейс создан' },
  trip_updated: { type: 'success', text: '✅ Рейс обновлён' },
  trip_deleted: { type: 'success', text: '🗑 Рейс удалён' },

  // Клиенты
  client_created: { type: 'success', text: '✅ Клиент добавлен' },
  client_updated: { type: 'success', text: '✅ Клиент обновлён' },
  client_deleted: { type: 'success', text: '🗑 Клиент удалён' },

  // Водители
  driver_created: { type: 'success', text: '✅ Водитель добавлен' },
  driver_updated: { type: 'success', text: '✅ Водитель обновлён' },
  driver_deleted: { type: 'success', text: '🗑 Водитель удалён' },

  // Подрядчики
  contractor_created: { type: 'success', text: '✅ Подрядчик добавлен' },
  contractor_updated: { type: 'success', text: '✅ Подрядчик обновлён' },
  contractor_deleted: { type: 'success', text: '🗑 Подрядчик удалён' },

  // Локации
  location_created: { type: 'success', text: '✅ Локация добавлена' },
  location_updated: { type: 'success', text: '✅ Локация обновлена' },
  location_deleted: { type: 'success', text: '🗑 Локация удалена' },

  // Экспедирование
  forwarding_created: { type: 'success', text: '✅ Заявка создана' },
  forwarding_updated: { type: 'success', text: '✅ Заявка обновлена' },
  forwarding_deleted: { type: 'success', text: '🗑 Заявка удалена' },

  // Расходы
  expense_added: { type: 'success', text: '✅ Расход добавлен' },
  expense_deleted: { type: 'success', text: '🗑 Расход удалён' },

  // Телеметрия
  telemetry_saved: { type: 'success', text: '✅ Телеметрия сохранена' },

  // Документы
  document_uploaded: { type: 'success', text: '✅ Документ загружен' },

  // Общие ошибки
  error: { type: 'error', text: 'Что-то пошло не так' },
};

function buildMessage(key: string | null, customMsg: string | null): ToastConfig | null {
  if (!key) return null;
  if (key === 'error') {
    return {
      type: 'error',
      text: customMsg ? `❌ ${customMsg}` : '❌ Что-то пошло не так',
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
  const [key, setKey] = useState(0); // чтобы анимация перезапускалась

  useEffect(() => {
    const msg = buildMessage(toastKey, errorMsg);
    if (!msg) return;

    setVisible(msg);
    setKey((k) => k + 1);

    // Через 3 секунды скрываем и очищаем URL
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

  const bg =
    visible.type === 'success'
      ? 'bg-emerald-600 text-white'
      : visible.type === 'error'
        ? 'bg-red-600 text-white'
        : 'bg-slate-800 text-white';

  return (
    <div
      key={key}
      className="fixed top-4 right-4 z-[100] max-w-[360px] pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`${bg} rounded-xl px-4 py-3 shadow-2xl font-medium text-sm animate-[toast-slide-in_200ms_ease-out]`}
      >
        {visible.text}
      </div>

      {/* Инлайн-стили для анимации — Next/Tailwind arbitrary values не всегда работают */}
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
