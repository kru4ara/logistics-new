'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const STORAGE_KEY = 'sidebar-pinned';

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
  const [isPinned, setIsPinned] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Читаем pin-состояние из localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true') setIsPinned(true);
    } catch {}
  }, []);

  // Сохраняем pin
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(isPinned));
    } catch {}
  }, [isPinned, mounted]);

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
