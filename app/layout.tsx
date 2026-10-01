import './globals.css';
import { Suspense } from 'react';
import Navbar from './components/Navbar';
import Toaster from './components/Toaster';

export const metadata = {
  title: 'Logistics CRM',
  description: 'Управление рейсами и расходами',
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
