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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          รายงานสรุปการเดินรถ (Fleet Reports)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          สรุปสถิติระยะทาง จำนวนเที่ยววิ่ง และระยะเวลาการปฏิบัติงานของรถรับ-ส่งประจำวัน
        </p>
      </div>
      
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Filter and Presets Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-2 items-center pb-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            ช่วงเวลาด่วน:
          </span>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            onClick={() => handlePreset('today')}
          >
            วันนี้ (Today)
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            onClick={() => handlePreset('yesterday')}
          >
            เมื่อวาน (Yesterday)
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            onClick={() => handlePreset('last7days')}
          >
            7 วันล่าสุด (Last 7 Days)
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            onClick={() => handlePreset('this_month')}
          >
            เดือนนี้ (This Month)
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              ตั้งแต่วันที่
            </label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              ถึงวันที่
            </label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              ยานพาหนะ
            </label>
            <select 
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[160px]"
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">รถทุกคัน (All Vehicles)</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate_number} ({v.model})</option>
              ))}
            </select>
          </div>
          
          <div className="ml-auto flex gap-2.5">
            <button 
              className="px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all shadow-xs disabled:opacity-60"
              onClick={fetchReports}
              disabled={loading}
            >
              {loading ? 'กำลังดึงข้อมูล...' : 'กรอง / รีเฟรช'}
            </button>
            <button 
              className="px-4 py-2 bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              onClick={handleExportCsv}
              disabled={reports.length === 0}
            >
              <span>ดาวน์โหลด CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            ระยะทางรวมทั้งหมด
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {totals.totalDistanceKm.toFixed(2)} <span className="text-xs font-sans font-normal text-slate-500">km</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            จำนวนเที่ยววิ่งสำเร็จ
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {totals.totalTrips} <span className="text-xs font-sans font-normal text-slate-500">เที่ยว</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            ชั่วโมงการวิ่งรวม
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {totals.totalActiveHours.toFixed(2)} <span className="text-xs font-sans font-normal text-slate-500">ชม.</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            ระยะทางเฉลี่ยต่อเที่ยว
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {totals.avgDistancePerTrip.toFixed(2)} <span className="text-xs font-sans font-normal text-slate-500">km</span>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th 
                  className="px-5 py-3.5 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  วันที่ {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3.5">
                  ทะเบียนรถ
                </th>
                <th 
                  className="px-5 py-3.5 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('total_trips')}
                >
                  จำนวนเที่ยว {sortField === 'total_trips' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-5 py-3.5 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('total_distance_km')}
                >
                  ระยะทางรวม (km) {sortField === 'total_distance_km' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3.5">
                  เวลาวิ่งงาน (ชม.)
                </th>
                <th className="px-5 py-3.5">
                  เฉลี่ยต่อเที่ยว (km)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedReports.length > 0 ? (
                sortedReports.map((report, idx) => {
                  const avgDist = report.total_trips > 0 ? report.total_distance_km / report.total_trips : 0;
                  return (
                    <tr key={`${report.date}-${report.vehicle_id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{report.date}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{report.plate_number}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-mono tabular-nums">{report.total_trips}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900 font-mono tabular-nums">{report.total_distance_km.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-mono tabular-nums">{report.active_duration_hours.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-mono tabular-nums">{avgDist.toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    ไม่พบข้อมูลสถิติเที่ยววิ่งในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
