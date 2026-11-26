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

    expect(screen.getAllByText(/ระยะทาง:/i).length).toBeGreaterThanOrEqual(1);
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

  it('does not bounce back or overwrite user-selected vehicle when vehicleList updates with new reference while telemetry is running', () => {
    const useHistoricalTripSpy = vi.spyOn(tripHook, 'useHistoricalTrip');

    const initialList = [
      { id: 'shuttle-cm-01', name: 'Shuttle 1' },
      { id: 'shuttle-cm-02', name: 'Shuttle 2' },
    ];

    const { rerender } = render(
      <HistoricalTripReplay
        initialVehicleId="shuttle-cm-01"
        vehicleList={initialList}
      />
    );

    const vehicleSelect = screen.getByLabelText(/select vehicle/i) as HTMLSelectElement;
    expect(vehicleSelect.value).toBe('shuttle-cm-01');

    // User chooses shuttle-cm-02 in the dropdown
    fireEvent.change(vehicleSelect, { target: { value: 'shuttle-cm-02' } });

    expect(useHistoricalTripSpy).toHaveBeenLastCalledWith('shuttle-cm-02', expect.any(String));
    expect(vehicleSelect.value).toBe('shuttle-cm-02');

    // Telemetry packet arrives: vehicleList prop re-renders with a new array reference
    rerender(
      <HistoricalTripReplay
        initialVehicleId="shuttle-cm-01"
        vehicleList={[...initialList]}
      />
    );

    // MUST NOT bounce back to shuttle-cm-01!
    expect(useHistoricalTripSpy).toHaveBeenLastCalledWith('shuttle-cm-02', expect.any(String));
    expect(vehicleSelect.value).toBe('shuttle-cm-02');
  });

  it('notifies onVehicleChange callback when user changes vehicle in HistoricalTripReplay', () => {
    const handleVehicleChange = vi.fn();
    render(
      <HistoricalTripReplay
        initialVehicleId="shuttle-cm-01"
        vehicleList={[
          { id: 'shuttle-cm-01', name: 'Shuttle 1' },
          { id: 'shuttle-cm-02', name: 'Shuttle 2' },
        ]}
        onVehicleChange={handleVehicleChange}
      />
    );

    const vehicleSelect = screen.getByLabelText(/select vehicle/i);
    fireEvent.change(vehicleSelect, { target: { value: 'shuttle-cm-02' } });

    expect(handleVehicleChange).toHaveBeenCalledWith('shuttle-cm-02');
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

  it('renders compact mode with "ขยายเต็มจอ" button', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    const expandBtn = screen.getByRole('button', { name: /expand replay map to full screen/i });
    expect(expandBtn).toBeInTheDocument();
    expect(screen.getByTestId('maximize-replay-map-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
  });

  it('clicking "ขยายเต็มจอ" toggles fullscreen mode and shows "ออกจากเต็มจอ" button', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    const expandBtn = screen.getByRole('button', { name: /expand replay map to full screen/i });
    fireEvent.click(expandBtn);

    const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
    expect(exitBtn).toBeInTheDocument();
    expect(screen.getByTestId('minimize-replay-map-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /expand replay map to full screen/i })).not.toBeInTheDocument();

    // Clicking exit button returns to compact mode
    fireEvent.click(exitBtn);
    expect(screen.getByRole('button', { name: /expand replay map to full screen/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
  });

  it('pressing Escape exits fullscreen mode', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    const expandBtn = screen.getByRole('button', { name: /expand replay map to full screen/i });
    fireEvent.click(expandBtn);

    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Should return to compact mode
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand replay map to full screen/i })).toBeInTheDocument();
  });

  it('allows selecting vehicle and date while in fullscreen mode', () => {
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

    // Expand to fullscreen
    fireEvent.click(screen.getByRole('button', { name: /expand replay map to full screen/i }));

    // In fullscreen, select vehicle
    const fullscreenVehicleSelect = screen.getByLabelText(/fullscreen select vehicle/i);
    fireEvent.change(fullscreenVehicleSelect, { target: { value: 'shuttle-02' } });
    expect(useHistoricalTripSpy).toHaveBeenCalledWith('shuttle-02', expect.any(String));

    // In fullscreen, select date
    const fullscreenDateInput = screen.getByLabelText(/fullscreen select date/i);
    fireEvent.change(fullscreenDateInput, { target: { value: '2026-11-20' } });
    expect(useHistoricalTripSpy).toHaveBeenCalledWith('shuttle-02', '2026-11-20');
  });

  it('docks player bar below map in compact mode, and floats in fullscreen mode', () => {
    render(<HistoricalTripReplay initialVehicleId="shuttle-01" />);

    // Compact mode: player bar is docked
    const playerBar = screen.getByTestId('replay-player-bar');
    expect(playerBar).toHaveAttribute('data-variant', 'docked');

    // Switch to fullscreen mode
    const expandBtn = screen.getByRole('button', { name: /expand replay map to full screen/i });
    fireEvent.click(expandBtn);

    // Fullscreen mode: player bar is floating
    const fsPlayerBar = screen.getByTestId('replay-player-bar');
    expect(fsPlayerBar).toHaveAttribute('data-variant', 'floating');
  });
});
