import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripPlayback } from '../useTripPlayback';
import { HistoricalPoint } from '../../types/historical';

describe('useTripPlayback', () => {
  const samplePoints: HistoricalPoint[] = [
    { vehicle_id: 'v1', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
    { vehicle_id: 'v1', lat: 13.74, lng: 100.53, speed: 25, heading: 95, recorded_at: '2026-10-28T08:00:10Z' },
    { vehicle_id: 'v1', lat: 13.75, lng: 100.54, speed: 30, heading: 100, recorded_at: '2026-10-28T08:00:20Z' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes at index 0 and paused', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentPoint).toEqual(samplePoints[0]);
    expect(result.current.progressPercent).toBe(0);
  });

  it('allows seeking to valid index within bounds', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(1);
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentPoint).toEqual(samplePoints[1]);
    expect(result.current.progressPercent).toBe(50);
  });

  it('clamps seeking index outside bounds', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(99);
    });
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.progressPercent).toBe(100);

    act(() => {
      result.current.seekToIndex(-5);
    });
    expect(result.current.currentIndex).toBe(0);
  });

  it('toggles play and pauses at end of route', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    // Fast-forward ticker timer
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Seek to last point
    act(() => {
      result.current.seekToIndex(2);
    });
    expect(result.current.currentIndex).toBe(2);

    // When playing at end, next tick should pause
    act(() => {
      result.current.play();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('resets playback to start', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    act(() => {
      result.current.seekToIndex(2);
      result.current.reset();
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('handles empty points array gracefully', () => {
    const { result } = renderHook(() => useTripPlayback([]));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentPoint).toBeNull();
    expect(result.current.traversedPoints).toEqual([]);
    expect(result.current.progressPercent).toBe(0);

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('updates speedMultiplier correctly', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    expect(result.current.speedMultiplier).toBe(1);
    act(() => {
      result.current.setSpeedMultiplier(5);
    });
    expect(result.current.speedMultiplier).toBe(5);
  });

  it('togglePlay toggles playing state', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    expect(result.current.isPlaying).toBe(false);
    act(() => {
      result.current.togglePlay();
    });
    expect(result.current.isPlaying).toBe(true);
    act(() => {
      result.current.togglePlay();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('provides correct traversedPoints as index advances', () => {
    const { result } = renderHook(() => useTripPlayback(samplePoints));
    expect(result.current.traversedPoints).toEqual([samplePoints[0]]);

    act(() => {
      result.current.seekToIndex(1);
    });
    expect(result.current.traversedPoints).toEqual([samplePoints[0], samplePoints[1]]);

    act(() => {
      result.current.seekToIndex(2);
    });
    expect(result.current.traversedPoints).toEqual(samplePoints);
  });

  it('resets when points array changes', () => {
    let pts = samplePoints;
    const { result, rerender } = renderHook(() => useTripPlayback(pts));

    act(() => {
      result.current.seekToIndex(2);
    });
    expect(result.current.currentIndex).toBe(2);

    pts = [
      { vehicle_id: 'v2', lat: 13.80, lng: 100.60, speed: 10, heading: 0, recorded_at: '2026-10-28T09:00:00Z' },
    ];
    rerender();

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });
});
