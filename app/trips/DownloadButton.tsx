'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { TripCardData } from './TripsBulkList';

export default function DownloadButton({ data }: { data: TripCardData[] }) {
  async function handleDownload() {
    // Ленивая загрузка xlsx — только по клику
    const XLSX = await import('xlsx');

    const rows = data.map((trip) => {
      const tripExpenses = trip.expenses || 0;
      const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
      return {
        'Рейс №': trip.trip_number || '',
        'Клиент': trip.clientName || 'Не указан',
        'Заявка': trip.client_request_number || '',
        'Маршрут': trip.route || '',
        'Статус': trip.status,
        'Фрахт (€)': trip.revenue_eur || 0,
        'Расходы (€)': Math.round(tripExpenses * 100) / 100,
        'Прибыль (€)': Math.round(tripProfit * 100) / 100,
      };
    });

    const totalRevenue = data.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const totalExpenses = data.reduce((sum, t) => sum + (t.expenses || 0), 0);
    const profit = totalRevenue - totalExpenses;

    rows.push({
      'Рейс №': 'ИТОГО',
      'Клиент': '',
      'Заявка': '',
      'Маршрут': '',
      'Статус': '',
      'Фрахт (€)': Math.round(totalRevenue * 100) / 100,
      'Расходы (€)': Math.round(totalExpenses * 100) / 100,
      'Прибыль (€)': Math.round(profit * 100) / 100,
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Рейсы');
    XLSX.writeFile(workbook, 'trips.xlsx');
  }

  return (
    <Button onClick={handleDownload} variant="default">
      <Download className="w-4 h-4 mr-2" />
      Скачать Excel
    </Button>
  );
}
