import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Bus,
  Check,
} from 'lucide-react';
import { DailyMetricsMap } from '../types/metrics';
import { FleetMap } from '../types/telemetry';
import {
  computeVehicleComparisonForTimeframe,
  computeTimeframeTrendData,
  computeHourlyActivityData,
  AnalyticsTimeframe,
  DailyRecordItem,
} from '../services/analyticsCalculator';
import { fetchTimeframeVehicleMetrics } from '../services/historicalTelemetryService';
import { VehicleComparisonChart } from './charts/VehicleComparisonChart';
import { Trend7DayChart } from './charts/Trend7DayChart';
import { HourlyActivityChart } from './charts/HourlyActivityChart';

export type AnalyticsTab = 'vehicles' | 'trend' | 'trend7d' | 'hourly';

export interface FleetDistanceAnalyticsCardProps {
  dailyMetrics: DailyMetricsMap;
  vehicles: FleetMap;
  lastSeenMap: Record<string, number>;
  past7DayRecords?: DailyRecordItem[];
  hourlyDistanceMap?: Record<string, Record<number, number>>;
  now?: number;
  className?: string;
  defaultTab?: AnalyticsTab;
}

export const FleetDistanceAnalyticsCard: React.FC<FleetDistanceAnalyticsCardProps> = ({
  dailyMetrics,
  vehicles,
  past7DayRecords,
  hourlyDistanceMap,
  now,
  className,
  defaultTab = 'vehicles',
}) => {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>(() => {
    if (defaultTab === 'trend7d') return 'week';
    return 'today';
  });

  const [activeTab, setActiveTab] = useState<'vehicles' | 'trend'>(() => {
    if (defaultTab === 'trend7d' || defaultTab === 'hourly') return 'trend';
    return 'vehicles';
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [isVehicleMenuOpen, setIsVehicleMenuOpen] = useState(false);
  const vehicleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vehicleMenuRef.current && !vehicleMenuRef.current.contains(e.target as Node)) {
        setIsVehicleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [recordsCache, setRecordsCache] = useState<Partial<Record<AnalyticsTimeframe, DailyRecordItem[]>>>({});

  const handleTimeframeChange = async (newTf: AnalyticsTimeframe) => {
    setTimeframe(newTf);
    if (newTf === 'month' && !recordsCache.month) {
      try {
        const data = await fetchTimeframeVehicleMetrics('month', now ? new Date(now) : new Date());
        setRecordsCache((prev) => ({ ...prev, month: data }));
      } catch (err) {
        console.warn('Failed to fetch month telemetry metrics:', err);
      }
    } else if (newTf === 'year' && !recordsCache.year) {
      try {
        const data = await fetchTimeframeVehicleMetrics('year', now ? new Date(now) : new Date());
        setRecordsCache((prev) => ({ ...prev, year: data }));
      } catch (err) {
        console.warn('Failed to fetch year telemetry metrics:', err);
      }
    }
  };

  const activeRecords = useMemo(() => {
    if (timeframe === 'week') {
      return recordsCache.week ?? past7DayRecords ?? [];
    }
    if (timeframe === 'month') {
      return recordsCache.month ?? [];
    }
    if (timeframe === 'year') {
      return recordsCache.year ?? [];
    }
    return [];
  }, [timeframe, recordsCache, past7DayRecords]);

  const uniqueVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(vehicles).forEach((id) => ids.add(id));
    Object.keys(dailyMetrics).forEach((id) => ids.add(id));
    past7DayRecords?.forEach((r) => {
      if (r.vehicle_id) ids.add(r.vehicle_id);
    });
    Object.values(recordsCache).forEach((list) => {
      list?.forEach((r) => {
        if (r.vehicle_id) ids.add(r.vehicle_id);
      });
    });
    return Array.from(ids).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [vehicles, dailyMetrics, past7DayRecords, recordsCache]);

  const comparisonData = useMemo(
    () =>
      computeVehicleComparisonForTimeframe(
        timeframe,
        dailyMetrics,
        activeRecords,
        vehicles,
        now ? new Date(now) : undefined
      ),
    [timeframe, dailyMetrics, activeRecords, vehicles, now]
  );

  const trendPoints = useMemo(
    () =>
      computeTimeframeTrendData(
        timeframe,
        dailyMetrics,
        activeRecords,
        now ? new Date(now) : undefined,
        selectedVehicleId
      ),
    [timeframe, dailyMetrics, activeRecords, now, selectedVehicleId]
  );

  const hourlyActivityPoints = useMemo(
    () =>
      computeHourlyActivityData(
        hourlyDistanceMap ?? {},
        selectedVehicleId,
        dailyMetrics
      ),
    [hourlyDistanceMap, selectedVehicleId, dailyMetrics]
  );

  const tab2Config = useMemo(() => {
    switch (timeframe) {
      case 'today':
        return {
          label: 'กิจกรรมรายชั่วโมง',
          ariaLabel: 'ดูกราฟกิจกรรมรายชั่วโมง',
          icon: Clock,
        };
      case 'week':
        return {
          label: 'แนวโน้ม 7 วัน',
          ariaLabel: 'ดูกราฟแนวโน้ม 7 วันย้อนหลัง',
          icon: TrendingUp,
        };
      case 'month':
        return {
          label: 'แนวโน้ม 30 วัน',
          ariaLabel: 'ดูกราฟแนวโน้ม 30 วันย้อนหลัง',
          icon: TrendingUp,
        };
      case 'year':
        return {
          label: 'แนวโน้ม 12 เดือน',
          ariaLabel: 'ดูกราฟแนวโน้ม 12 เดือนย้อนหลัง',
          icon: TrendingUp,
        };
    }
  }, [timeframe]);

  const Tab2Icon = tab2Config.icon;

  const timeframeOptions: Array<{ id: AnalyticsTimeframe; label: string }> = [
    { id: 'today', label: 'วันนี้' },
    { id: 'week', label: 'สัปดาห์' },
    { id: 'month', label: 'เดือน' },
    { id: 'year', label: 'ปี' },
  ];

  const containerClasses =
    className ??
    'bg-white border border-slate-200 text-slate-800 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-colors';

  return (
    <section aria-label="Fleet Mileage Analytics Card" className={containerClasses}>
      {/* Header: Title and Collapse Button */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
              <span>สถิติระยะทางวิ่ง</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans truncate">
              เปรียบเทียบระยะทางและแนวโน้มการใช้งานของกองรถ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'ขยายการ์ดกราฟ' : 'ย่อการ์ดกราฟ'}
            title={isCollapsed ? 'ขยายการ์ดกราฟ' : 'ย่อการ์ดกราฟ'}
            className="flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors min-h-[42px] sm:min-h-0 shrink-0"
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
      </div>

      {!isCollapsed && (
        <>
          {/* Controls Bar: Timeframe Selector & Vehicle Filter */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 relative z-30">
            {/* Timeframe Selector Pills */}
            <div
              role="group"
              aria-label="เลือกช่วงเวลาวิเคราะห์"
              className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl gap-1 w-full sm:w-auto"
            >
              {timeframeOptions.map((opt) => {
                const isSelected = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleTimeframeChange(opt.id)}
                    className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-xs font-semibold transition-all min-h-[38px] sm:min-h-0 flex items-center justify-center ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Vehicle Selector Dropdown matching DailyDistanceTable */}
            <div ref={vehicleMenuRef} className="relative w-full sm:w-auto min-w-0 z-40">
              <label htmlFor="vehicle-analytics-select" className="sr-only">
                เลือกคันรถสำหรับดูกราฟ
              </label>

              {/* Accessible native select for keyboard & screen readers & test automation */}
              <select
                id="vehicle-analytics-select"
                aria-label="เลือกคันรถสำหรับดูกราฟ"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="sr-only"
                tabIndex={-1}
              >
                <option value="all">ทุกคัน</option>
                {uniqueVehicleIds.map((vId) => (
                  <option key={vId} value={vId}>
                    {vId}
                  </option>
                ))}
              </select>

              {/* Custom Styled Trigger Button */}
              <button
                type="button"
                onClick={() => setIsVehicleMenuOpen(!isVehicleMenuOpen)}
                aria-expanded={isVehicleMenuOpen}
                className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-200/90 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 text-xs sm:text-sm font-semibold transition-all shadow-xs hover:border-slate-300 dark:hover:border-slate-600 min-h-[42px] sm:min-h-0 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {selectedVehicleId === 'all' ? 'ทุกคัน' : selectedVehicleId}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isVehicleMenuOpen ? 'rotate-180 text-emerald-500' : ''
                  }`}
                />
              </button>

              {/* Custom Dropdown Menu matching DailyDistanceTable */}
              {isVehicleMenuOpen && (
                <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-64 max-w-[calc(100vw-3rem)] bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-[100] animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                    เลือกรถสำหรับดูกราฟ
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId('all');
                      setIsVehicleMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-left transition-colors min-h-[40px] sm:min-h-0 cursor-pointer ${
                      selectedVehicleId === 'all'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/50'
                        : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>ทุกคัน</span>
                    </div>
                    {selectedVehicleId === 'all' && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>

                  {uniqueVehicleIds.map((vId) => {
                    const isSelected = selectedVehicleId === vId;
                    return (
                      <button
                        key={vId}
                        type="button"
                        onClick={() => {
                          setSelectedVehicleId(vId);
                          setIsVehicleMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-left transition-colors min-h-[40px] sm:min-h-0 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/50'
                            : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{vId}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* View Switcher Tabs (Segmented Control) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl w-full sm:w-fit gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              aria-label="ดูกราฟเปรียบเทียบรายคัน"
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[38px] sm:min-h-0 ${
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
              onClick={() => setActiveTab('trend')}
              aria-label={tab2Config.ariaLabel}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[38px] sm:min-h-0 ${
                activeTab === 'trend'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Tab2Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab2Config.label}</span>
            </button>
          </div>

          {/* Active Chart Display Area */}
          <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 rounded-xl p-3 sm:p-4">
            {activeTab === 'vehicles' && (
              <VehicleComparisonChart
                items={comparisonData.items}
                avgDistanceKm={comparisonData.avgDistanceKm}
                selectedVehicleId={selectedVehicleId}
              />
            )}
            {activeTab === 'trend' && (
              timeframe === 'today' ? (
                <HourlyActivityChart
                  hours={hourlyActivityPoints}
                  selectedVehicleId={selectedVehicleId}
                />
              ) : (
                <Trend7DayChart
                  points={trendPoints}
                  selectedVehicleId={selectedVehicleId}
                  timeframe={timeframe}
                />
              )
            )}
          </div>
        </>
      )}
    </section>
  );
};
