'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

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

export default function DownloadButton({ data }: { data: any[] }) {
  function handleDownload() {
    const rows = data.map((trip) => ({
      '№ рейса': trip.trip_number || '',
      'Клиент': trip.clients?.name || 'Не указан',
      'Маршрут': trip.route || '',
      'Статус': STATUS_LABELS[trip.status] || trip.status,
      'Фрахт (€)': r2(trip.revenue_eur || 0),
      'Расходы (€)': r2(trip.expenses || 0),
      'Прибыль (€)': r2((trip.revenue_eur || 0) - (trip.expenses || 0)),
    }));

    const totalRevenue = data?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
    const totalExpenses = data?.reduce((sum, t) => sum + (t.expenses || 0), 0) || 0;
    const profit = totalRevenue - totalExpenses;

    rows.push({
      '№ рейса': 'ИТОГО',
      'Клиент': '',
      'Маршрут': '',
      'Статус': '',
      'Фрахт (€)': r2(totalRevenue),
      'Расходы (€)': r2(totalExpenses),
      'Прибыль (€)': r2(profit),
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
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
