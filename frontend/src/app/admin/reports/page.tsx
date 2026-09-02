'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { DailyReportSummary, Vehicle } from '@/lib/types';
import { 
  calculateReportTotals, 
  generateCsvContent, 
  downloadCsv, 
  getDatePresetRange 
} from '@/lib/report-utils';

type SortField = 'date' | 'total_distance_km' | 'total_trips';
type SortOrder = 'asc' | 'desc';

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReportSummary[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    // Initial fetch for today
    const { start_date, end_date } = getDatePresetRange('today');
    setStartDate(start_date);
    setEndDate(end_date);
    
    // Fetch vehicles for filter
    api.vehicles.list().then(setVehicles).catch(console.error);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReports();
    }
  }, [startDate, endDate, vehicleId]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.reports.getDaily({
        start_date: startDate,
        end_date: endDate,
        vehicle_id: vehicleId || undefined
      });
      setReports(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset: 'today' | 'yesterday' | 'last7days' | 'this_month') => {
    const { start_date, end_date } = getDatePresetRange(preset);
    setStartDate(start_date);
    setEndDate(end_date);
  };

  const handleExportCsv = () => {
    if (reports.length === 0) return;
    const csvContent = generateCsvContent(sortedReports);
    downloadCsv(csvContent, `report-${startDate}-to-${endDate}.csv`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totals = useMemo(() => calculateReportTotals(reports), [reports]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [reports, sortField, sortOrder]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Daily Mileage & Fleet Report</h1>
      
      {error && <div className="bg-red-50 text-red-600 p-4 rounded">{error}</div>}

      <div className="bg-white p-4 rounded shadow space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="font-semibold mr-2">Presets:</span>
          <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded" onClick={() => handlePreset('today')}>Today</button>
          <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded" onClick={() => handlePreset('yesterday')}>Yesterday</button>
          <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded" onClick={() => handlePreset('last7days')}>Last 7 Days</button>
          <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded" onClick={() => handlePreset('this_month')}>This Month</button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input 
              type="date" 
              className="border p-2 rounded" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input 
              type="date" 
              className="border p-2 rounded" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle</label>
            <select 
              className="border p-2 rounded w-48"
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate_number}</option>
              ))}
            </select>
          </div>
          
          <div className="ml-auto flex gap-2">
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={fetchReports}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Filter / Refresh'}
            </button>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              onClick={handleExportCsv}
              disabled={reports.length === 0}
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Total Fleet Mileage</div>
          <div className="text-2xl font-bold">{totals.totalDistanceKm.toFixed(2)} km</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Total Trips Completed</div>
          <div className="text-2xl font-bold">{totals.totalTrips}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Active Driving Duration</div>
          <div className="text-2xl font-bold">{totals.totalActiveHours.toFixed(2)} hrs</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Avg Distance per Trip</div>
          <div className="text-2xl font-bold">{totals.avgDistancePerTrip.toFixed(2)} km</div>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                Date {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plate Number
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('total_trips')}
              >
                Total Trips {sortField === 'total_trips' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('total_distance_km')}
              >
                Total Distance (km) {sortField === 'total_distance_km' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Duration (hrs)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Distance / Trip (km)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedReports.length > 0 ? (
              sortedReports.map((report, idx) => {
                const avgDist = report.total_trips > 0 ? report.total_distance_km / report.total_trips : 0;
                return (
                  <tr key={`${report.date}-${report.vehicle_id}-${idx}`}>
                    <td className="px-6 py-4 whitespace-nowrap">{report.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{report.plate_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{report.total_trips}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{report.total_distance_km.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{report.active_duration_hours.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{avgDist.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No trips exist in the given range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
