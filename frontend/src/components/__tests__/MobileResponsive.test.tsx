import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyDistanceTable } from '../DailyDistanceTable';
import { TelemetryHUD } from '../TelemetryHUD';
import { ReplayToolbar } from '../ReplayToolbar';
import { ReplayPlayerBar } from '../ReplayPlayerBar';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';
import { HistoricalPoint } from '../../types/historical';

describe('Mobile Responsive Ergonomics & Clarity', () => {
  it('renders DailyDistanceTable with mobile card touch targets and clear metrics', () => {
    const handleOpenMap = vi.fn();
    const metrics: DailyMetricsMap = {
      'BUS-01': {
        vehicle_id: 'BUS-01',
        date: '2026-11-03',
        total_distance_km: 26.4,
        max_speed_kmh: 52,
        avg_speed_kmh: 28,
        active_minutes: 85,
        last_updated_at: new Date().toISOString(),
      },
    };
    const vehicles: FleetMap = {
      'BUS-01': {
        vehicle_id: 'BUS-01',
        lat: 18.79,
        lng: 98.98,
        speed: 34.2,
        heading: 90,
        timestamp: Date.now(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={vehicles}
        lastSeenMap={{ 'BUS-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={handleOpenMap}
      />
    );

    // Verify search input has mobile-safe text size
    const searchInput = screen.getByPlaceholderText(/search vehicle/i);
    expect(searchInput.className).toContain('text-sm');

    // Verify mobile card has min-h-[44px]
    const mobileCard = screen.getByTestId('mobile-vehicle-card-BUS-01');
    expect(mobileCard.className).toContain('min-h-[44px]');
    expect(mobileCard).toHaveTextContent('26.40 km');
    expect(mobileCard).toHaveTextContent('1h 25m');
    expect(mobileCard).toHaveTextContent('Live');

    // Verify mobile card button has min-h-[44px]
    const viewButton = screen.getByRole('button', { name: /view map for bus-01/i });
    expect(viewButton.className).toContain('min-h-[44px]');

    // Click triggers navigation
    fireEvent.click(viewButton);
    expect(handleOpenMap).toHaveBeenCalledWith('BUS-01');
  });

  it('renders TelemetryHUD with accessible mobile layout and all essential metrics', () => {
    const telemetry = {
      vehicle_id: 'BUS-01',
      lat: 18.79,
      lng: 98.98,
      speed: 36.5,
      heading: 120,
      timestamp: Date.now(),
    };
    const handleClose = vi.fn();

    render(
      <TelemetryHUD
        telemetry={telemetry}
        status="connected"
        lastSeen={Date.now()}
        dailyDistanceKm={26.4}
        isOnline={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('BUS-01')).toBeInTheDocument();
    expect(screen.getByText('36.5')).toBeInTheDocument();
    expect(screen.getByText('26.40')).toBeInTheDocument();
    expect(screen.getByText('120°')).toBeInTheDocument();

    // Verify close buttons on mobile
    const closeButtons = screen.getAllByRole('button', {
      name: /deselect vehicle and return to all vehicles overview/i,
    });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders ReplayToolbar with touch-friendly form controls on mobile', () => {
    const onDateChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <ReplayToolbar
        selectedDate="2026-11-03"
        onDateChange={onDateChange}
        selectedVehicleId="BUS-01"
        onVehicleChange={vi.fn()}
        vehicleList={[{ id: 'BUS-01', name: 'Shuttle 1' }]}
        summary={{
          vehicle_id: 'BUS-01',
          date: '2026-11-03',
          total_distance_km: 30.2,
          max_speed_kmh: 50,
          avg_speed_kmh: 25,
          total_points: 1200,
          start_time: '2026-11-03T01:00:00Z',
          end_time: '2026-11-03T08:00:00Z',
        }}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /รีเฟรชข้อมูล/i });
    expect(refreshBtn.className).toContain('min-h-[42px]');
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders ReplayPlayerBar with speed buttons accessible on mobile and clear metrics', () => {
    const currentPt: HistoricalPoint = {
      vehicle_id: 'BUS-01',
      lat: 18.79,
      lng: 98.98,
      speed: 32.0,
      heading: 45,
      recorded_at: '2026-11-03T04:30:00.000Z',
    };
    const onSpeedChange = vi.fn();

    render(
      <ReplayPlayerBar
        currentIndex={20}
        totalPoints={100}
        isPlaying={false}
        speedMultiplier={1}
        currentPoint={currentPt}
        startTimeStr="2026-11-03T01:00:00.000Z"
        endTimeStr="2026-11-03T08:00:00.000Z"
        totalDistanceKm={30.2}
        distanceCoveredKm={12.4}
        onTogglePlay={vi.fn()}
        onReset={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={onSpeedChange}
      />
    );

    // Speed option button exists and is clickable
    const speed2xBtn = screen.getByRole('button', { name: '2x' });
    fireEvent.click(speed2xBtn);
    expect(onSpeedChange).toHaveBeenCalledWith(2);

    expect(screen.getByText('32.0 กม./ชม.')).toBeInTheDocument();
    expect(screen.getByText(/12.4 \/ 30.2 กม./)).toBeInTheDocument();
  });
});
