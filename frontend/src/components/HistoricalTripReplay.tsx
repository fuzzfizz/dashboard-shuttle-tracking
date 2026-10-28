import React, { useState, useMemo } from 'react';
import { ReplayToolbar } from './ReplayToolbar';
import { ReplayMap } from './ReplayMap';
import { ReplayPlayerBar } from './ReplayPlayerBar';
import { useHistoricalTrip } from '../hooks/useHistoricalTrip';
import { useTripPlayback } from '../hooks/useTripPlayback';
import { getBangkokDate } from '../hooks/useDailyMetrics';
import { haversineDistance } from '../services/distanceCalculator';

export interface HistoricalTripReplayProps {
  initialVehicleId?: string;
  vehicleList?: Array<{ id: string; name: string }>;
}

const DEFAULT_VEHICLES = [
  { id: 'shuttle-01', name: 'Shuttle 1' },
  { id: 'shuttle-02', name: 'Shuttle 2' },
];

export const HistoricalTripReplay: React.FC<HistoricalTripReplayProps> = ({
  initialVehicleId = 'shuttle-01',
  vehicleList = DEFAULT_VEHICLES,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDate());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId);

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full relative overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Toolbar */}
      <ReplayToolbar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedVehicleId={selectedVehicleId}
        onVehicleChange={setSelectedVehicleId}
        vehicleList={effectiveVehicleList}
        summary={summary}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Main Map Viewport */}
      <ReplayMap
        points={points}
        traversedPoints={traversedPoints}
        currentPoint={currentPoint}
        isLoading={isLoading}
      />

      {/* Floating Bottom Player Bar */}
      <ReplayPlayerBar
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
  );
};

export default HistoricalTripReplay;
