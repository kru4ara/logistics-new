import './globals.css';
import { Suspense } from 'react';
import type { Viewport } from 'next';
import Navbar from './components/Navbar';
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
        <Navbar />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        <main style={{ minHeight: 'calc(100vh - 60px)' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
