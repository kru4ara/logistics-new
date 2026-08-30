'use client';

import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function DownloadButton({ data }: { data: any[] }) {
  function handleDownload() {
    const rows = data.map((route) => ({
      'Маршрут': route.route,
      'Фрахт (€)': route.revenue,
      'Расходы (€)': route.expenses,
      'Количество рейсов': route.count
    }));

    // Добавляем итоговую строку
    const totalRevenue = data?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;
    const totalExpenses = data?.reduce((sum, r) => sum + (r.expenses || 0), 0) || 0;
    const totalCount = data?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

    rows.push({
      'Маршрут': 'ИТОГО',
      'Фрахт (€)': totalRevenue,
      'Расходы (€)': totalExpenses,
      'Количество рейсов': totalCount
    });

    // Создаем настоящий Excel-файл (XLSX)
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Маршруты');
    XLSX.writeFile(workbook, 'routes.xlsx');
  }

  return (
    <Button onClick={handleDownload} variant="default">
      📥 Скачать Excel
    </Button>
  );
}
