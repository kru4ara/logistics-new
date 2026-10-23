'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const STORAGE_KEY = 'sidebar-pinned';

function readPinnedFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AppShellClient({
  role,
  userName,
  children,
}: {
  role: string | null;
  userName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Ленивая инициализация — выполняется один раз при монтировании.
  // На сервере вернёт false (typeof window === 'undefined'), на клиенте — из localStorage.
  const [isPinned, setIsPinned] = useState<boolean>(readPinnedFromStorage);

  // Сохраняем pin при изменении
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isPinned));
    } catch {}
  }, [isPinned]);

  function togglePin() {
    setIsPinned((v) => !v);
  }

  // Сдвиг контента — только когда панель закреплена
  const contentPadding = isPinned ? 'md:pl-60' : 'md:pl-16';

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        userName={userName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isPinned={isPinned}
        onTogglePin={togglePin}
      />

      <Navbar
        role={role}
        userName={userName}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className={`${contentPadding} transition-[padding] duration-200 ease-smooth`}>
        {children}
      </div>
    </div>
  );
}
