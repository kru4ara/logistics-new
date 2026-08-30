'use client';

import { Button } from '@/components/ui/button';

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

    // Преобразуем в CSV (для Excel)
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => (row as any)[h] ?? '').join(','))
    ].join('\n');

    // Создаем ссылку на скачивание
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'report.csv';
    link.click();
  }

  return (
    <Button onClick={handleDownload} variant="default">
      📥 Скачать Excel
    </Button>
  );
}
