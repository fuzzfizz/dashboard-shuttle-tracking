import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bus, Maximize2, Minimize2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReplayToolbar } from './ReplayToolbar';
import { ReplayMap } from './ReplayMap';
import { ReplayPlayerBar } from './ReplayPlayerBar';
import { useHistoricalTrip } from '../hooks/useHistoricalTrip';
import { useTripPlayback } from '../hooks/useTripPlayback';
import { getBangkokDate } from '../hooks/useDailyMetrics';
import { getBangkokMinRetentionDate, shiftBangkokDate } from '../services/historicalDateUtils';
import { haversineDistance } from '../services/distanceCalculator';
import { fetchHistoricalVehicles } from '../services/historicalTelemetryService';

export interface HistoricalTripReplayProps {
  initialVehicleId?: string;
  vehicleList?: Array<{ id: string; name: string }>;
  onVehicleChange?: (vehicleId: string) => void;
}

export const HistoricalTripReplay: React.FC<HistoricalTripReplayProps> = ({
  initialVehicleId,
  vehicleList: propVehicleList,
  onVehicleChange,
}) => {
  const [fetchedVehicles, setFetchedVehicles] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!propVehicleList || propVehicleList.length === 0) {
      fetchHistoricalVehicles().then((list) => {
        if (list && list.length > 0) {
          setFetchedVehicles(list);
        }
      });
    }
  }, [propVehicleList]);

  const vehicleList = useMemo(() => {
    if (propVehicleList && propVehicleList.length > 0) {
      return propVehicleList;
    }
    return fetchedVehicles;
  }, [propVehicleList, fetchedVehicles]);

  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDate());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    initialVehicleId || vehicleList[0]?.id || ''
  );
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const lastInitialVehicleIdRef = useRef<string | undefined>(initialVehicleId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);

  // Adopt new initialVehicleId only when the prop explicitly changes to a different vehicle
  useEffect(() => {
    if (initialVehicleId && initialVehicleId !== lastInitialVehicleIdRef.current) {
      lastInitialVehicleIdRef.current = initialVehicleId;
      setSelectedVehicleId(initialVehicleId);
    }
  }, [initialVehicleId]);

  // If no vehicle was selected initially (e.g. list was loading), initialize with the first vehicle
  useEffect(() => {
    if (!selectedVehicleId && vehicleList.length > 0) {
      const fallback = initialVehicleId || vehicleList[0].id;
      setSelectedVehicleId(fallback);
      lastInitialVehicleIdRef.current = fallback;
    }
  }, [vehicleList, selectedVehicleId, initialVehicleId]);

  const handleVehicleChange = (id: string) => {
    setSelectedVehicleId(id);
    lastInitialVehicleIdRef.current = id;
    onVehicleChange?.(id);
  };

  const { points, summary, isLoading, refetch } = useHistoricalTrip(
    selectedVehicleId,
    selectedDate
  );

  const {
    currentIndex,
    currentPoint,
    isPlaying,
    speedMultiplier,
    traversedPoints,
    togglePlay,
    reset,
    seekToIndex,
    setSpeedMultiplier,
  } = useTripPlayback(points);

  // Calculate distance covered up to current scrubber point
  const distanceCoveredKm = useMemo(() => {
    if (traversedPoints.length <= 1) return 0;
    let dist = 0;
    for (let i = 1; i < traversedPoints.length; i++) {
      dist += haversineDistance(
        traversedPoints[i - 1].lat,
        traversedPoints[i - 1].lng,
        traversedPoints[i].lat,
        traversedPoints[i].lng
      );
    }
    return Math.round(dist * 10) / 10;
  }, [traversedPoints]);

  const effectiveVehicleList = useMemo(() => {
    const list = [...vehicleList];
    if (selectedVehicleId && !list.some((v) => v.id === selectedVehicleId)) {
      list.unshift({ id: selectedVehicleId, name: selectedVehicleId });
    }
    return list;
  }, [vehicleList, selectedVehicleId]);

  const minDate = getBangkokMinRetentionDate(14);
  const maxDate = getBangkokDate();

  if (isMapFullscreen) {
    return (
      <div className="fixed inset-0 z-[1500] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden">
        {/* Floating Top Controls */}
        <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1100] flex flex-wrap items-center justify-between pointer-events-none gap-2">
          {/* Left / Center: Compact Date & Vehicle Selectors */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pointer-events-auto">
            {/* Branding / Title Badge (compact) */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl shadow-md shrink-0">
              <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg">
                <Bus className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white hidden md:inline">
                ประวัติเส้นทาง
              </span>
            </div>

            {/* Vehicle Selector (Compact) */}
            <div className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 sm:py-2 rounded-2xl shadow-md shrink-0">
              <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <label htmlFor="fullscreen-vehicle-select" className="sr-only">เลือกรถ</label>
              <select
                id="fullscreen-vehicle-select"
                aria-label="Fullscreen Select Vehicle"
                value={selectedVehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
              >
                {effectiveVehicleList.map((v) => (
                  <option key={v.id} value={v.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector with Steppers (Compact) */}
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1 sm:px-2 rounded-2xl shadow-md shrink-0">
              <button
                type="button"
                aria-label="วันก่อนหน้า (เต็มจอ)"
                title="วันก่อนหน้า"
                disabled={selectedDate <= minDate}
                onClick={() => setSelectedDate(shiftBangkokDate(selectedDate, -1, minDate, maxDate))}
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 px-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <label htmlFor="fullscreen-date-input" className="sr-only">เลือกวันที่</label>
                <input
                  id="fullscreen-date-input"
                  aria-label="Fullscreen Select Date"
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-medium text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                aria-label="วันถัดไป (เต็มจอ)"
                title="วันถัดไป"
                disabled={selectedDate >= maxDate}
                onClick={() => setSelectedDate(shiftBangkokDate(selectedDate, 1, minDate, maxDate))}
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Exit Fullscreen button */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
            <button
              onClick={() => setIsMapFullscreen(false)}
              aria-label="Exit full screen"
              title="ออกจากโหมดเต็มจอ (Esc)"
              data-testid="minimize-replay-map-button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-white/95 hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md transition-colors text-xs font-semibold min-h-[36px] cursor-pointer"
            >
              <Minimize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">ออกจากเต็มจอ</span>
              <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400">Esc</kbd>
            </button>
          </div>
        </div>

        {/* Fullscreen Map Viewport */}
        <div className="w-full h-full relative flex-1">
          <ReplayMap
            points={points}
            traversedPoints={traversedPoints}
            currentPoint={currentPoint}
            isLoading={isLoading}
          />
          <ReplayPlayerBar
            className="absolute bottom-3 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-auto sm:w-[92vw] sm:max-w-xl md:max-w-3xl pb-[env(safe-area-inset-bottom)]"
            currentIndex={currentIndex}
            totalPoints={points.length}
            isPlaying={isPlaying}
            speedMultiplier={speedMultiplier}
            currentPoint={currentPoint}
            startTimeStr={summary.start_time}
            endTimeStr={summary.end_time}
            totalDistanceKm={summary.total_distance_km}
            distanceCoveredKm={distanceCoveredKm}
            onTogglePlay={togglePlay}
            onReset={reset}
            onSeek={seekToIndex}
            onSpeedChange={setSpeedMultiplier}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 bg-slate-100 dark:bg-slate-900 min-h-screen">
      {/* Top Toolbar */}
      <ReplayToolbar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedVehicleId={selectedVehicleId}
        onVehicleChange={handleVehicleChange}
        vehicleList={effectiveVehicleList}
        summary={summary}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Compact Map Card */}
      <div className="flex flex-col gap-3">
        {/* Card Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  แผนที่เส้นทางย้อนหลัง
                </h2>
                {selectedVehicleId && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                    {selectedVehicleId}
                  </span>
                )}
                {selectedDate && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {selectedDate}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historical Trip Replay
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMapFullscreen(true)}
            aria-label="Expand replay map to full screen"
            title="ขยายแผนที่เต็มจอ"
            data-testid="maximize-replay-map-button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors min-h-[36px] shadow-sm cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">ขยายเต็มจอ</span>
          </button>
        </div>

        {/* Map Container */}
        <div className="h-[380px] sm:h-[480px] md:h-[540px] lg:h-[580px] xl:h-[620px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl relative">
          <ReplayMap
            points={points}
            traversedPoints={traversedPoints}
            currentPoint={currentPoint}
            isLoading={isLoading}
          />
          <ReplayPlayerBar
            className="absolute bottom-3 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[1000] w-auto sm:w-[92vw] sm:max-w-xl md:max-w-3xl pb-[env(safe-area-inset-bottom)]"
            currentIndex={currentIndex}
            totalPoints={points.length}
            isPlaying={isPlaying}
            speedMultiplier={speedMultiplier}
            currentPoint={currentPoint}
            startTimeStr={summary.start_time}
            endTimeStr={summary.end_time}
            totalDistanceKm={summary.total_distance_km}
            distanceCoveredKm={distanceCoveredKm}
            onTogglePlay={togglePlay}
            onReset={reset}
            onSeek={seekToIndex}
            onSpeedChange={setSpeedMultiplier}
          />
        </div>
      </div>
    </div>
  );
};

export default HistoricalTripReplay;
