'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { tripStatusKey } from '../../lib/i18n/labels';

export type ReportRow = {
  id: string;
  trip_number: number | null;
  clientName: string;
  route: string;
  status: string;
  revenue_eur: number;
  expenses: number;
};


function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function DownloadButton({ data }: { data: ReportRow[] }) {
  const { t: tr } = useT();
  async function handleDownload() {
    const ExcelJS = (await import('exceljs')).default;

    const rows = data.map((trip) => ({
      tripNumber: trip.trip_number || '',
      clientName: trip.clientName || tr('trips.clientUnknown'),
      route: trip.route || '',
      status: (tripStatusKey(trip.status) ? tr(tripStatusKey(trip.status)!) : trip.status),
      revenue: r2(trip.revenue_eur || 0),
      expenses: r2(trip.expenses || 0),
      profit: r2((trip.revenue_eur || 0) - (trip.expenses || 0)),
    }));

    const totalRevenue = data.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const totalExpenses = data.reduce((sum, t) => sum + (t.expenses || 0), 0);
    const profit = totalRevenue - totalExpenses;

    rows.push({
      tripNumber: tr('trips.excelTotal'),
      clientName: '',
      route: '',
      status: '',
      revenue: r2(totalRevenue),
      expenses: r2(totalExpenses),
      profit: r2(profit),
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tr('rep.xlOrders'));
    worksheet.columns = [
      { header: tr('rep.tripNo'), key: 'tripNumber', width: 10 },
      { header: tr('trips.filterClient'), key: 'clientName', width: 30 },
      { header: tr('trips.colRoute'), key: 'route', width: 40 },
      { header: tr('trips.status'), key: 'status', width: 16 },
      { header: tr('trips.colFreight'), key: 'revenue', width: 14, style: { numFmt: '0.00' } },
      { header: tr('trips.colExpenses'), key: 'expenses', width: 14, style: { numFmt: '0.00' } },
      { header: tr('trips.colProfit'), key: 'profit', width: 14, style: { numFmt: '0.00' } },
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
      {tr('trips.downloadExcel')}
    </Button>
  );
}
