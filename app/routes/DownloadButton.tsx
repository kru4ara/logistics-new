'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export type RouteCardData = {
  route: string;
  revenue: number;
  expenses: number;
  count: number;
  profit: number;
};

export default function DownloadButton({ data }: { data: RouteCardData[] }) {
  function handleDownload() {
    const rows = data.map((r) => ({
      'Маршрут': r.route,
      'Фрахт (€)': Math.round((r.revenue || 0) * 100) / 100,
      'Расходы (€)': Math.round((r.expenses || 0) * 100) / 100,
      'Прибыль (€)': Math.round((r.profit || 0) * 100) / 100,
      'Количество рейсов': r.count || 0,
    }));

    const totalRevenue = data.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const totalExpenses = data.reduce((sum, r) => sum + (r.expenses || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const totalCount = data.reduce((sum, r) => sum + (r.count || 0), 0);

    rows.push({
      'Маршрут': 'ИТОГО',
      'Фрахт (€)': Math.round(totalRevenue * 100) / 100,
      'Расходы (€)': Math.round(totalExpenses * 100) / 100,
      'Прибыль (€)': Math.round(totalProfit * 100) / 100,
      'Количество рейсов': totalCount,
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Маршруты');
    XLSX.writeFile(workbook, 'routes.xlsx');
  }

  return (
    <Button onClick={handleDownload} variant="default">
      <Download className="w-4 h-4 mr-2" />
      Скачать Excel
    </Button>
  );
}
