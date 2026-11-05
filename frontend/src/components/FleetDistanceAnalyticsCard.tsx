import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Award,
  Route,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';
import { FleetMap } from '../types/telemetry';
import {
  calculateFleetAnalyticsSummary,
  computeVehicleComparisonData,
  compute7DayTrendData,
  computeHourlyActivityData,
} from '../services/analyticsCalculator';
import { VehicleComparisonChart } from './charts/VehicleComparisonChart';
import { Trend7DayChart } from './charts/Trend7DayChart';
import { HourlyActivityChart } from './charts/HourlyActivityChart';

export type AnalyticsTab = 'vehicles' | 'trend7d' | 'hourly';

export interface FleetDistanceAnalyticsCardProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  now?: number;
  className?: string;
  defaultTab?: AnalyticsTab;
}

export const FleetDistanceAnalyticsCard: React.FC<FleetDistanceAnalyticsCardProps> = ({
  dailyMetrics,
  vehicles,
  now,
  className,
  defaultTab = 'vehicles',
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(defaultTab);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const summary = useMemo(
    () => calculateFleetAnalyticsSummary(dailyMetrics, vehicles),
    [dailyMetrics, vehicles]
  );

  const vehicleComparisonItems = useMemo(
    () => computeVehicleComparisonData(dailyMetrics, vehicles),
    [dailyMetrics, vehicles]
  );

  const trend7DayPoints = useMemo(
    () => compute7DayTrendData(dailyMetrics, [], now ? new Date(now) : undefined),
    [dailyMetrics, now]
  );

  const hourlyActivityPoints = useMemo(
    () => computeHourlyActivityData(vehicles, dailyMetrics),
    [vehicles, dailyMetrics]
  );

  const formatHoursMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '0 นาที';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0 && m > 0) return `${h} ชม. ${m} นาที`;
    if (h > 0) return `${h} ชม.`;
    return `${m} นาที`;
  };

  const containerClasses =
    className ??
    'bg-white border border-slate-200 text-slate-800 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-all duration-300';

  return (
    <section aria-label="Fleet Mileage Analytics Card" className={containerClasses}>
      {/* Card Header with Collapse/Expand Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:white flex items-center gap-2">
              <span>สถิติและกราฟวิเคราะห์การเดินรถ</span>
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 hidden sm:inline font-sans">
                Fleet Distance Analytics
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              ภาพรวมระยะทาง ความสมดุลของฟลีต และความหนาแน่นรายชั่วโมง
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'ขยายการ์ดสถิติ' : 'ย่อการ์ดสถิติ'}
          title={isCollapsed ? 'ขยายการ์ดสถิติ' : 'ย่อการ์ดสถิติ'}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
        >
          {isCollapsed ? (
            <>
              <span>ขยาย</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>ย่อ</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* KPI Stat Cards (4 columns on desktop, 2x2 grid on mobile) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* 1. Total Fleet Distance */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-sans">
                <span>ระยะทางรวมวันนี้</span>
                <Route className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-base sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {summary.totalDistanceKm.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">km</span>
              </div>
            </div>

            {/* 2. Fleet Average */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-sans">
                <span>เฉลี่ยต่อคัน</span>
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-base sm:text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {summary.avgDistanceKm.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">km</span>
              </div>
            </div>

            {/* 3. Top Active Vehicle */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-sans">
                <span>คันที่วิ่งมากสุด</span>
                <Award className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400 truncate">
                {summary.topVehicleId}
                {summary.topVehicleDistanceKm > 0 && (
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    ({summary.topVehicleDistanceKm.toFixed(1)}k)
                  </span>
                )}
              </div>
            </div>

            {/* 4. Total Active Time */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-sans">
                <span>เวลาวิ่งสะสมรวม</span>
                <Clock className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                {formatHoursMinutes(summary.totalActiveMinutes)}
              </div>
            </div>
          </div>

          {/* View Switcher Tabs (Segmented Control) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl w-full sm:w-fit gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              aria-label="ดูกราฟเปรียบเทียบรายคัน"
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[42px] sm:min-h-0 ${
                activeTab === 'vehicles'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>เปรียบเทียบรายคัน</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trend7d')}
              aria-label="ดูกราฟแนวโน้ม 7 วันย้อนหลัง"
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[42px] sm:min-h-0 ${
                activeTab === 'trend7d'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>แนวโน้ม 7 วัน</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hourly')}
              aria-label="ดูกราฟกิจกรรมรายชั่วโมง"
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[42px] sm:min-h-0 ${
                activeTab === 'hourly'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>กิจกรรมรายชั่วโมง</span>
            </button>
          </div>

          {/* Active Chart Display Area */}
          <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 rounded-xl p-3 sm:p-4">
            {activeTab === 'vehicles' && (
              <VehicleComparisonChart
                items={vehicleComparisonItems}
                avgDistanceKm={summary.avgDistanceKm}
              />
            )}
            {activeTab === 'trend7d' && <Trend7DayChart points={trend7DayPoints} />}
            {activeTab === 'hourly' && <HourlyActivityChart hours={hourlyActivityPoints} />}
          </div>
        </>
      )}
    </section>
  );
};
