'use client';

import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function DownloadButton({ data }: { data: any[] }) {
  function handleDownload() {
    // Создаем данные для Excel
    const rows = data.map((trip) => {
      const tripExpenses = trip.expenses || 0;
      const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
      return {
        'Клиент': trip.clients?.name || 'Не указан',
        'Маршрут': trip.route || '',
        'Статус': trip.status,
        'Фрахт (€)': trip.revenue_eur || 0,
        'Расходы (€)': tripExpenses,
        'Прибыль (€)': tripProfit
      };
    });

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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет');
    XLSX.writeFile(workbook, 'report.xlsx');
  }

  return (
    <Button onClick={handleDownload} variant="default">
      📥 Скачать Excel
    </Button>
  );
}
