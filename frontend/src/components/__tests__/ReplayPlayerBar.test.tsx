import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayPlayerBar } from '../ReplayPlayerBar';
import { HistoricalPoint } from '../../types/historical';

describe('ReplayPlayerBar', () => {
  const currentPt: HistoricalPoint = {
    vehicle_id: 'shuttle-01',
    lat: 13.736,
    lng: 100.523,
    speed: 28.5,
    heading: 90,
    recorded_at: '2026-10-28T03:15:45.000Z',
  };

  it('renders playback controls and current telemetry HUD', () => {
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /เล่น/i })).toBeInTheDocument();
    expect(screen.getByText('28.5 กม./ชม.')).toBeInTheDocument();
    expect(screen.getByText('10:15:45')).toBeInTheDocument();
    expect(screen.getByText(/10.0 \/ 20.0 กม./)).toBeInTheDocument();
  });

  it('fires onTogglePlay on play button click', () => {
    const onTogglePlay = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={onTogglePlay}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /เล่น/i }));
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('fires onSpeedChange when speed pill is clicked', () => {
    const onSpeedChange = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={onSpeedChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '5x' }));
    expect(onSpeedChange).toHaveBeenCalledWith(5);
  });

  it('fires onSeek when range slider is scrubbed', () => {
    const onSeek = vi.fn();
    render(
      <ReplayPlayerBar
        currentIndex={50}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-10-28T01:00:00.000Z"
        endTimeStr="2026-10-28T05:00:00.000Z"
        totalDistanceKm={20.0}
        distanceCoveredKm={10.0}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={onSeek}
        onSpeedChange={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    expect(onSeek).toHaveBeenCalledWith(75);
  });
});
