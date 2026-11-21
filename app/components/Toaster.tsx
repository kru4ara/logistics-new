'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '../../lib/i18n/translate';
import type { T } from '../../lib/i18n/translate';
import { useT } from './I18nProvider';

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
  saved: { type: 'success', text: 'toast.saved' },
  created: { type: 'success', text: 'toast.created' },
  updated: { type: 'success', text: 'toast.updated' },
  deleted: { type: 'success', text: 'toast.deleted' },

  // Рейсы
  trip_created: { type: 'success', text: 'toast.tripCreated' },
  trip_updated: { type: 'success', text: 'toast.tripUpdated' },
  trip_deleted: { type: 'success', text: 'toast.tripDeleted' },

  // Клиенты
  client_created: { type: 'success', text: 'toast.clientCreated' },
  client_updated: { type: 'success', text: 'toast.clientUpdated' },
  client_deleted: { type: 'success', text: 'toast.clientDeleted' },

  // Водители
  driver_created: { type: 'success', text: 'toast.driverCreated' },
  driver_updated: { type: 'success', text: 'toast.driverUpdated' },
  driver_deleted: { type: 'success', text: 'toast.driverDeleted' },

  // Подрядчики
  contractor_created: { type: 'success', text: 'toast.ctrCreated' },
  contractor_updated: { type: 'success', text: 'toast.ctrUpdated' },
  contractor_deleted: { type: 'success', text: 'toast.ctrDeleted' },

  // Локации
  location_created: { type: 'success', text: 'toast.locCreated' },
  location_updated: { type: 'success', text: 'toast.locUpdated' },
  location_deleted: { type: 'success', text: 'toast.locDeleted' },

  // Экспедирование
  forwarding_created: { type: 'success', text: 'toast.fwdCreated' },
  forwarding_updated: { type: 'success', text: 'toast.fwdUpdated' },
  forwarding_deleted: { type: 'success', text: 'toast.fwdDeleted' },

  // Расходы
  expense_added: { type: 'success', text: 'toast.expAdded' },
  expense_deleted: { type: 'success', text: 'toast.expDeleted' },

  // Телеметрия
  telemetry_saved: { type: 'success', text: 'toast.telemetry' },

  // Документы
  document_uploaded: { type: 'success', text: 'cmp.docUploaded' },

  // Напоминания
  reminder_created: { type: 'success', text: 'toast.remCreated' },
  reminder_updated: { type: 'success', text: 'toast.remUpdated' },
  reminder_deleted: { type: 'success', text: 'toast.remDeleted' },
  reminder_done: { type: 'success', text: 'toast.remDone' },
  reminder_reopened: { type: 'info', text: 'toast.remReopened' },

  // Общие ошибки
  error: { type: 'error', text: 'toast.error' },
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

function buildMessage(key: string | null, customMsg: string | null, t: T): ToastConfig | null {
  if (!key) return null;
  if (key === 'error') {
    return {
      type: 'error',
      text: customMsg || t('toast.error'),
    };
  }
  const m = MESSAGES[key];
  return m ? { ...m, text: t(m.text as MessageKey) } : null;
}

export default function Toaster() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const toastKey = searchParams.get('toast');
  const errorMsg = searchParams.get('msg');

  // Сообщение — чистая функция от URL, поэтому состояние для него не нужно.
  // setState в эффекте вызывал бы лишний каскадный рендер
  // (react-hooks/set-state-in-effect).
  const visible = useMemo(
    () => buildMessage(toastKey, errorMsg, t),
    [toastKey, errorMsg, t]
  );

  useEffect(() => {
    if (!visible) return;

    // Скрываем тост: убираем toast/msg из URL — сообщение перестаёт
    // существовать как чистая функция от query-параметров.
    const hideTimer = setTimeout(() => {
      // Читаем актуальные query-параметры из адресной строки прямо в
      // колбэке таймера: это всегда текущее состояние URL, и эффекту не
      // нужно перезапускаться на каждый чужой параметр.
      const params = new URLSearchParams(window.location.search);
      params.delete('toast');
      params.delete('msg');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [visible, pathname, router]);

  if (!visible) return null;

  const meta = TYPE_META[visible.type];
  const Icon = meta.Icon;

  return (
    <div
      key={`${toastKey}|${errorMsg}`}
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
