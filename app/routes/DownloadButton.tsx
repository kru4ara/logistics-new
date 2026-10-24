'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export type RouteCardData = {
  route: string;
  revenue: number;
  expenses: number;
  count: number;
  profit: number;
};

export default function DownloadButton({ data }: { data: RouteCardData[] }) {
  async function handleDownload() {
    const ExcelJS = (await import('exceljs')).default;

    const rows = data.map((r) => ({
      route: r.route,
      revenue: Math.round((r.revenue || 0) * 100) / 100,
      expenses: Math.round((r.expenses || 0) * 100) / 100,
      profit: Math.round((r.profit || 0) * 100) / 100,
      count: r.count || 0,
    }));

    const totalRevenue = data.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const totalExpenses = data.reduce((sum, r) => sum + (r.expenses || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const totalCount = data.reduce((sum, r) => sum + (r.count || 0), 0);

    rows.push({
      route: 'ИТОГО',
      revenue: Math.round(totalRevenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round(totalProfit * 100) / 100,
      count: totalCount,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Маршруты');
    worksheet.columns = [
      { header: 'Маршрут', key: 'route', width: 50 },
      { header: 'Фрахт (€)', key: 'revenue', width: 14, style: { numFmt: '0.00' } },
      { header: 'Расходы (€)', key: 'expenses', width: 14, style: { numFmt: '0.00' } },
      { header: 'Прибыль (€)', key: 'profit', width: 14, style: { numFmt: '0.00' } },
      { header: 'Количество рейсов', key: 'count', width: 18 },
    ];
    worksheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'routes.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button onClick={handleDownload} variant="default">
      <Download className="w-4 h-4 mr-2" />
      Скачать Excel
    </Button>
  );
}
