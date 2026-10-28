import React, { useState, useEffect, useMemo } from 'react';
import { ReplayToolbar } from './ReplayToolbar';
import { ReplayMap } from './ReplayMap';
import { ReplayPlayerBar } from './ReplayPlayerBar';
import { useHistoricalTrip } from '../hooks/useHistoricalTrip';
import { useTripPlayback } from '../hooks/useTripPlayback';
import { getBangkokDate } from '../hooks/useDailyMetrics';
import { haversineDistance } from '../services/distanceCalculator';
import { fetchHistoricalVehicles } from '../services/historicalTelemetryService';

export interface HistoricalTripReplayProps {
  initialVehicleId?: string;
  vehicleList?: Array<{ id: string; name: string }>;
}

export const HistoricalTripReplay: React.FC<HistoricalTripReplayProps> = ({
  initialVehicleId,
  vehicleList: propVehicleList,
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

  // Sync selectedVehicleId when vehicle list or initialVehicleId updates
  useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId);
    } else if (vehicleList.length > 0 && (!selectedVehicleId || !vehicleList.some((v) => v.id === selectedVehicleId))) {
      setSelectedVehicleId(vehicleList[0].id);
    }
  }, [vehicleList, initialVehicleId]);

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
