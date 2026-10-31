'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export type ReportRow = {
  id: string;
  trip_number: number | null;
  clientName: string;
  route: string;
  status: string;
  revenue_eur: number;
  expenses: number;
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function DownloadButton({ data }: { data: ReportRow[] }) {
  async function handleDownload() {
    const ExcelJS = (await import('exceljs')).default;

    const rows = data.map((trip) => ({
      tripNumber: trip.trip_number || '',
      clientName: trip.clientName || 'Не указан',
      route: trip.route || '',
      status: STATUS_LABELS[trip.status] || trip.status,
      revenue: r2(trip.revenue_eur || 0),
      expenses: r2(trip.expenses || 0),
      profit: r2((trip.revenue_eur || 0) - (trip.expenses || 0)),
    }));

    const totalRevenue = data.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const totalExpenses = data.reduce((sum, t) => sum + (t.expenses || 0), 0);
    const profit = totalRevenue - totalExpenses;

    rows.push({
      tripNumber: 'ИТОГО',
      clientName: '',
      route: '',
      status: '',
      revenue: r2(totalRevenue),
      expenses: r2(totalExpenses),
      profit: r2(profit),
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Заказы');
    worksheet.columns = [
      { header: '№ рейса', key: 'tripNumber', width: 10 },
      { header: 'Клиент', key: 'clientName', width: 30 },
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
