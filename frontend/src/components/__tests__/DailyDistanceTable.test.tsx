import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyDistanceTable } from '../DailyDistanceTable';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';

describe('DailyDistanceTable', () => {
  it('renders empty state when no vehicles are available', () => {
    render(
      <DailyDistanceTable
        dailyMetrics={{}}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );
    expect(screen.getByText(/no distance recorded today/i)).toBeInTheDocument();
  });

  it('renders vehicle list with daily distance and triggers onOpenVehicleMap when clicked', () => {
    const handleOpenMap = vi.fn();
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 18.5,
        max_speed_kmh: 45,
        avg_speed_kmh: 25,
        active_minutes: 60,
        last_updated_at: new Date().toISOString(),
      },
    };
    const vehicles: FleetMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        lat: 13.75,
        lng: 100.5,
        speed: 30,
        timestamp: Date.now(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={vehicles}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={handleOpenMap}
      />
    );

    expect(screen.getByText('EV-01')).toBeInTheDocument();
    expect(screen.getAllByText('18.50 km').length).toBeGreaterThan(0);

    // Click open button
    const openBtn = screen.getByRole('button', { name: /open map for ev-01/i });
    fireEvent.click(openBtn);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('triggers onOpenVehicleMap when clicking desktop row', () => {
    const handleOpenMap = vi.fn();
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 18.5,
        max_speed_kmh: 45,
        avg_speed_kmh: 25,
        active_minutes: 60,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={handleOpenMap}
      />
    );

    const row = screen.getByTestId('vehicle-row-EV-01');
    fireEvent.click(row);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('sorts vehicles by distance-desc, then speed-desc, then id-asc on sort button click', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 10.0,
        max_speed_kmh: 60, // higher speed
        avg_speed_kmh: 20,
        active_minutes: 30,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 35.0, // higher distance
        max_speed_kmh: 40,
        avg_speed_kmh: 30,
        active_minutes: 90,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );

    // Default: distance-desc (EV-02 first: 35km, EV-01 second: 10km)
    let vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-02');
    expect(vehicleItems[1]).toHaveTextContent('EV-01');

    // Toggle sort button -> speed-desc (EV-01 first: 60km/h, EV-02 second: 40km/h)
    const sortBtn = screen.getByRole('button', { name: /toggle sort/i });
    fireEvent.click(sortBtn);

    vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-01');
    expect(vehicleItems[1]).toHaveTextContent('EV-02');

    // Toggle again -> id-asc (EV-01 first, EV-02 second)
    fireEvent.click(sortBtn);
    vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-01');
    expect(vehicleItems[1]).toHaveTextContent('EV-02');

    // Toggle again -> cycle back to distance-desc (EV-02 first, EV-01 second)
    fireEvent.click(sortBtn);
    vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-02');
    expect(vehicleItems[1]).toHaveTextContent('EV-01');
  });

  it('displays Live and Signal Lost statuses accurately based on lastSeen', () => {
    const now = 100000;
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 12.0,
        max_speed_kmh: 30,
        avg_speed_kmh: 20,
        active_minutes: 15,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 5.0,
        max_speed_kmh: 25,
        avg_speed_kmh: 15,
        active_minutes: 10,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{
          'EV-01': now - 2000, // 2s ago (< 15s -> Live)
          'EV-02': now - 30000, // 30s ago (> 15s -> Signal Lost)
        }}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
        now={now}
      />
    );

    expect(screen.getAllByText('Live')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Signal Lost')[0]).toBeInTheDocument();
  });

  it('renders total fleet distance in header badge', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 12.5,
        max_speed_kmh: 40,
        avg_speed_kmh: 20,
        active_minutes: 30,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 25.5,
        max_speed_kmh: 50,
        avg_speed_kmh: 30,
        active_minutes: 60,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );

    // Total = 38.00 km (present in header pill and summary card)
    expect(screen.getAllByText(/38\.00 km/i).length).toBeGreaterThan(0);
  });

  it('handles mobile card clicks with accessible min-h-[44px] targets', () => {
    const handleOpenMap = vi.fn();
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 14.2,
        max_speed_kmh: 40,
        avg_speed_kmh: 25,
        active_minutes: 45,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={handleOpenMap}
      />
    );

    const mobileCard = screen.getByTestId('mobile-vehicle-card-EV-01');
    expect(mobileCard.className).toContain('min-h-[44px]');
    fireEvent.click(mobileCard);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('renders summary metric cards for total distance, max speed, and tracked units', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 12.5,
        max_speed_kmh: 42.0,
        avg_speed_kmh: 22.0,
        active_minutes: 65, // 1h 5m
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 25.5,
        max_speed_kmh: 58.0,
        avg_speed_kmh: 30.0,
        active_minutes: 120, // 2h 0m
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );

    // Summary cards
    expect(screen.getByText('Total Distance')).toBeInTheDocument();
    expect(screen.getAllByText('Max Speed').length).toBeGreaterThan(0);
    expect(screen.getByText('Tracked Shuttles')).toBeInTheDocument();
    expect(screen.getAllByText('38.00 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('58.0 km/h').length).toBeGreaterThan(0);
    expect(screen.getByText('2 shuttles')).toBeInTheDocument();

    // Table row columns
    expect(screen.getAllByText('1h 5m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2h 0m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42.0 km/h').length).toBeGreaterThan(0);
  });

  it('renders mobile card with 3 metrics: distance, max speed, and active time', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 15.5,
        max_speed_kmh: 48.0,
        avg_speed_kmh: 24.0,
        active_minutes: 75, // 1h 15m
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
      />
    );

    const mobileCard = screen.getByTestId('mobile-vehicle-card-EV-01');
    expect(mobileCard).toHaveTextContent('15.50 km');
    expect(mobileCard).toHaveTextContent('48.0 km/h');
    expect(mobileCard).toHaveTextContent('1h 15m');
  });
});
