import { DailyReportSummary } from './types.ts';

export function calculateReportTotals(reports: DailyReportSummary[]) {
  if (!reports || reports.length === 0) {
    return {
      totalDistanceKm: 0,
      totalTrips: 0,
      totalActiveHours: 0,
      avgDistancePerTrip: 0,
      activeVehiclesCount: 0
    };
  }

  let totalDistanceKm = 0;
  let totalTrips = 0;
  let totalActiveHours = 0;
  const uniqueVehicles = new Set<string>();

  for (const report of reports) {
    totalDistanceKm += report.total_distance_km;
    totalTrips += report.total_trips;
    totalActiveHours += report.active_duration_hours;
    uniqueVehicles.add(report.vehicle_id);
  }

  const avgDistancePerTrip = totalTrips > 0 ? totalDistanceKm / totalTrips : 0;

  return {
    totalDistanceKm,
    totalTrips,
    totalActiveHours,
    avgDistancePerTrip,
    activeVehiclesCount: uniqueVehicles.size
  };
}

export function generateCsvContent(reports: DailyReportSummary[]): string {
  const BOM = '\uFEFF';
  const headers = ['Date', 'Plate Number', 'Total Trips', 'Total Distance (km)', 'Active Duration (hours)', 'Avg Distance/Trip (km)'];
  
  const rows = reports.map(report => {
    const avgDist = report.total_trips > 0 ? report.total_distance_km / report.total_trips : 0;
    return [
      report.date,
      report.plate_number,
      report.total_trips.toString(),
      report.total_distance_km.toFixed(2),
      report.active_duration_hours.toFixed(2),
      avgDist.toFixed(2)
    ].join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\n');
}

export function downloadCsv(content: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getDatePresetRange(preset: 'today' | 'yesterday' | 'last7days' | 'this_month'): { start_date: string, end_date: string } {
  const now = new Date();
  
  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  switch (preset) {
    case 'today':
      return { start_date: formatDate(now), end_date: formatDate(now) };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { start_date: formatDate(yesterday), end_date: formatDate(yesterday) };
    }
    case 'last7days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start_date: formatDate(start), end_date: formatDate(now) };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start_date: formatDate(start), end_date: formatDate(now) };
    }
  }
}
