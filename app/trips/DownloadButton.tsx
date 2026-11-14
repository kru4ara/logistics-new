'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { TripCardData } from './TripsBulkList';
import { tripStatusKey } from '../../lib/i18n/labels';
import { useT } from '../components/I18nProvider';

export default function DownloadButton({ data }: { data: TripCardData[] }) {
  const { t } = useT();
  async function handleDownload() {
    const ExcelJS = (await import('exceljs')).default;

    const rows = data.map((trip) => {
      const tripExpenses = trip.expenses || 0;
      const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
      return {
        tripNumber: trip.trip_number || '',
        clientName: trip.clientName || t('trips.clientUnknown'),
        clientRequestNumber: trip.client_request_number || '',
        route: trip.route || '',
        status: (() => { const k = tripStatusKey(trip.status); return k ? t(k) : trip.status; })(),
        revenue: trip.revenue_eur || 0,
        expenses: Math.round(tripExpenses * 100) / 100,
        profit: Math.round(tripProfit * 100) / 100,
      };
    });

    const totalRevenue = data.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const totalExpenses = data.reduce((sum, t) => sum + (t.expenses || 0), 0);
    const profit = totalRevenue - totalExpenses;

    rows.push({
      tripNumber: t('trips.excelTotal'),
      clientName: '',
      clientRequestNumber: '',
      route: '',
      status: '',
      revenue: Math.round(totalRevenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round(profit * 100) / 100,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(t('trips.excelSheet'));
    worksheet.columns = [
      { header: t('trips.colTripNo'), key: 'tripNumber', width: 10 },
      { header: t('trips.colClient'), key: 'clientName', width: 30 },
      { header: t('trips.colRequest'), key: 'clientRequestNumber', width: 16 },
      { header: t('trips.colRoute'), key: 'route', width: 40 },
      { header: t('trips.colStatus'), key: 'status', width: 16 },
      { header: t('trips.colFreight'), key: 'revenue', width: 14, style: { numFmt: '0.00' } },
      { header: t('trips.colExpenses'), key: 'expenses', width: 14, style: { numFmt: '0.00' } },
      { header: t('trips.colProfit'), key: 'profit', width: 14, style: { numFmt: '0.00' } },
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
      {t('trips.downloadExcel')}
    </Button>
  );
}
