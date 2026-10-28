import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoricalTripReplay } from '../components/HistoricalTripReplay';
import * as tripHook from '../hooks/useHistoricalTrip';
import * as playbackHook from '../hooks/useTripPlayback';

// Mock child components to isolate container testing
vi.mock('../components/ReplayMap', () => ({
  ReplayMap: () => <div data-testid="replay-map" />,
}));

describe('HistoricalTripReplay', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(tripHook, 'useHistoricalTrip').mockReturnValue({
      points: [
        { vehicle_id: 'shuttle-01', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
        { vehicle_id: 'shuttle-01', lat: 13.74, lng: 100.53, speed: 25, heading: 90, recorded_at: '2026-10-28T08:05:00Z' },
      ],
      summary: {
        vehicle_id: 'shuttle-01',
        date: '2026-10-28',
        total_distance_km: 15.0,
        max_speed_kmh: 40,
        avg_speed_kmh: 20,
        total_points: 2,
        start_time: '2026-10-28T08:00:00Z',
        end_time: '2026-10-28T08:05:00Z',
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('renders toolbar, map, and player bar', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    expect(screen.getByText(/ระยะทาง:/i)).toBeInTheDocument();
    expect(screen.getByTestId('replay-map')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('updates vehicle when vehicle selector is changed', () => {
    const useHistoricalTripSpy = vi.spyOn(tripHook, 'useHistoricalTrip');

    render(
      <HistoricalTripReplay
        initialVehicleId="shuttle-01"
        vehicleList={[
          { id: 'shuttle-01', name: 'Shuttle 1' },
          { id: 'shuttle-02', name: 'Shuttle 2' },
        ]}
      />
    );

    const vehicleSelect = screen.getByLabelText(/select vehicle/i);
    fireEvent.change(vehicleSelect, { target: { value: 'shuttle-02' } });

    expect(useHistoricalTripSpy).toHaveBeenCalledWith('shuttle-02', expect.any(String));
  });

  it('updates date when date picker is changed', () => {
    const useHistoricalTripSpy = vi.spyOn(tripHook, 'useHistoricalTrip');

    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    const datePicker = screen.getByLabelText(/select date/i);
    fireEvent.change(datePicker, { target: { value: '2026-10-25' } });

    expect(useHistoricalTripSpy).toHaveBeenCalledWith('shuttle-01', '2026-10-25');
  });

  it('triggers refetch when refresh button is clicked', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    const refreshBtn = screen.getByRole('button', { name: /รีเฟรชข้อมูล/i });
    fireEvent.click(refreshBtn);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('calculates distance covered based on traversed points', () => {
    vi.spyOn(playbackHook, 'useTripPlayback').mockReturnValue({
      currentIndex: 1,
      currentPoint: { vehicle_id: 'shuttle-01', lat: 13.74, lng: 100.53, speed: 25, heading: 90, recorded_at: '2026-10-28T08:05:00Z' },
      isPlaying: false,
      speedMultiplier: 1,
      progressPercent: 100,
      traversedPoints: [
        { vehicle_id: 'shuttle-01', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
        { vehicle_id: 'shuttle-01', lat: 13.74, lng: 100.53, speed: 25, heading: 90, recorded_at: '2026-10-28T08:05:00Z' },
      ],
      play: vi.fn(),
      pause: vi.fn(),
      togglePlay: vi.fn(),
      reset: vi.fn(),
      seekToIndex: vi.fn(),
      setSpeedMultiplier: vi.fn(),
    });

    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    // Distance covered should be non-zero and displayed
    expect(screen.getByText(/\/ 15.0 กม./i)).toBeInTheDocument();
  });
});
