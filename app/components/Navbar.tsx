'use client';

import { Menu, Truck } from 'lucide-react';
import Link from 'next/link';

export default function Navbar({
  role,
  userName,
  onMenuClick,
}: {
  role: string | null;
  userName: string;
  onMenuClick: () => void;
}) {
  if (!role) return null;

  const displayName = userName || (role === 'admin' ? 'Офис' : 'Водитель');
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 md:hidden bg-ink-900 border-b border-white/5 shadow-lg">
      <div className="h-14 px-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-200 hover:bg-white/5 transition-colors"
          aria-label="Открыть меню"
        >
          <Menu className="w-5 h-5" strokeWidth={2} />
        </button>

        <Link
          href={role === 'driver' ? '/driver' : '/'}
          className="flex items-center gap-2 shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-brand">
            <Truck className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-bold text-base tracking-tight hidden xs:inline sm:inline">
            Logistics CRM
          </span>
        </Link>

        <div className="ml-auto w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-xs shadow-brand shrink-0">
          {initials}
        </div>
      </div>
    </header>
  );
}
