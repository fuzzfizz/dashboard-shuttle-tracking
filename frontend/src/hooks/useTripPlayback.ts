import { useState, useEffect, useCallback, useMemo } from 'react';
import { HistoricalPoint, SpeedMultiplier } from '../types/historical';

export function useTripPlayback(points: HistoricalPoint[]) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1);

  const totalPoints = points.length;

  // Reset index when points dataset changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [points]);

  const currentPoint = useMemo(() => {
    if (totalPoints === 0) return null;
    return points[Math.min(currentIndex, totalPoints - 1)];
  }, [points, currentIndex, totalPoints]);

  const traversedPoints = useMemo(() => {
    if (totalPoints === 0) return [];
    return points.slice(0, Math.min(currentIndex + 1, totalPoints));
  }, [points, currentIndex, totalPoints]);

  const progressPercent = useMemo(() => {
    if (totalPoints <= 1) return 0;
    return Math.round((currentIndex / (totalPoints - 1)) * 100);
  }, [currentIndex, totalPoints]);

  const play = useCallback(() => {
    if (totalPoints <= 1) return;
    setIsPlaying(true);
  }, [totalPoints]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekToIndex = useCallback(
    (index: number) => {
      if (totalPoints === 0) return;
      const clamped = Math.max(0, Math.min(index, totalPoints - 1));
      setCurrentIndex(clamped);
    },
    [totalPoints]
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  // Interval-based ticker calculation adapted to real timestamp deltas & speed multiplier
  useEffect(() => {
    if (!isPlaying || totalPoints <= 1) return;

    if (currentIndex >= totalPoints - 1) {
      setIsPlaying(false);
      return;
    }

    // Determine interval step between current point and next point
    const currTime = new Date(points[currentIndex].recorded_at).getTime();
    const nextTime = new Date(points[currentIndex + 1].recorded_at).getTime();
    const realDeltaMs = Math.max(500, Math.min(nextTime - currTime, 30000)); // Cap delta between 0.5s and 30s
    const scaledIntervalMs = Math.max(50, Math.round(realDeltaMs / speedMultiplier));

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= totalPoints - 1) {
          setIsPlaying(false);
          return totalPoints - 1;
        }
        return next;
      });
    }, scaledIntervalMs);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, totalPoints, points, speedMultiplier]);

  return {
    currentIndex,
    currentPoint,
    isPlaying,
    speedMultiplier,
    progressPercent,
    traversedPoints,
    play,
    pause,
    togglePlay,
    seekToIndex,
    reset,
    setSpeedMultiplier,
  };
}
