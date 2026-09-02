import './globals.css';
import Navbar from './components/Navbar';

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
        <main style={{ minHeight: 'calc(100vh - 60px)' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
