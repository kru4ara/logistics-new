'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

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

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        userName={userName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Navbar
        role={role}
        userName={userName}
        onMenuClick={() => setMobileOpen(true)}
      />

      {/* Контент — сдвинут на 64px вправо на десктопе */}
      <div className="md:pl-16 transition-[padding] duration-200 ease-smooth">
        {children}
      </div>
    </div>
  );
}
