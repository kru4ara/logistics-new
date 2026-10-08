import './globals.css';
import { Suspense } from 'react';
import type { Viewport } from 'next';
import AppShell from './components/AppShell';
import Toaster from './components/Toaster';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'Logistics CRM',
  description: 'Управление рейсами и расходами',
  applicationName: 'Logistics CRM',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'Logistics',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
