'use client';

import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function DownloadButton({ data }: { data: any[] }) {
  function handleDownload() {
    const rows = data.map((trip) => ({
      'Клиент': trip.clients?.name || 'Не указан',
      'Маршрут': trip.route || '',
      'Статус': trip.status,
      'Фрахт (€)': trip.revenue_eur || 0,
      'Расходы (€)': trip.expenses || 0,
      'Прибыль (€)': (trip.revenue_eur || 0) - (trip.expenses || 0)
    }));

    // Добавляем итоговую строку
    const totalRevenue = data?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
    const totalExpenses = data?.reduce((sum, t) => sum + (t.expenses || 0), 0) || 0;
    const profit = totalRevenue - totalExpenses;

    rows.push({
      'Клиент': 'ИТОГО',
      'Маршрут': '',
      'Статус': '',
      'Фрахт (€)': totalRevenue,
      'Расходы (€)': totalExpenses,
      'Прибыль (€)': profit
    });

    // Создаем настоящий Excel-файл (XLSX)
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Рейсы');
    XLSX.writeFile(workbook, 'trips.xlsx');
  }

  return (
    <Button onClick={handleDownload} variant="default">
      📥 Скачать Excel
    </Button>
  );
}
