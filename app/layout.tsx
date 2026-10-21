import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import AppShell from './components/AppShell';
import Toaster from './components/Toaster';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Logistics CRM',
  description: 'Управление рейсами и расходами',
  applicationName: 'Logistics CRM',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Logistics',
  },
  formatDetection: {
    telephone: false,
  },
};

export default async function RootLayout({
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
        <SpeedInsights />
      </body>
    </html>
  );
}
