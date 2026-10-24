'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { TripCardData } from './TripsBulkList';

export default function DownloadButton({ data }: { data: TripCardData[] }) {
  async function handleDownload() {
    const ExcelJS = (await import('exceljs')).default;

    const rows = data.map((trip) => {
      const tripExpenses = trip.expenses || 0;
      const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
      return {
        tripNumber: trip.trip_number || '',
        clientName: trip.clientName || 'Не указан',
        clientRequestNumber: trip.client_request_number || '',
        route: trip.route || '',
        status: trip.status,
        revenue: trip.revenue_eur || 0,
        expenses: Math.round(tripExpenses * 100) / 100,
        profit: Math.round(tripProfit * 100) / 100,
      };
    });

    const totalRevenue = data.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const totalExpenses = data.reduce((sum, t) => sum + (t.expenses || 0), 0);
    const profit = totalRevenue - totalExpenses;

    rows.push({
      tripNumber: 'ИТОГО',
      clientName: '',
      clientRequestNumber: '',
      route: '',
      status: '',
      revenue: Math.round(totalRevenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round(profit * 100) / 100,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Рейсы');
    worksheet.columns = [
      { header: 'Рейс №', key: 'tripNumber', width: 10 },
      { header: 'Клиент', key: 'clientName', width: 30 },
      { header: 'Заявка', key: 'clientRequestNumber', width: 16 },
      { header: 'Маршрут', key: 'route', width: 40 },
      { header: 'Статус', key: 'status', width: 16 },
      { header: 'Фрахт (€)', key: 'revenue', width: 14, style: { numFmt: '0.00' } },
      { header: 'Расходы (€)', key: 'expenses', width: 14, style: { numFmt: '0.00' } },
      { header: 'Прибыль (€)', key: 'profit', width: 14, style: { numFmt: '0.00' } },
    ];
    worksheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trips.xlsx';
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
