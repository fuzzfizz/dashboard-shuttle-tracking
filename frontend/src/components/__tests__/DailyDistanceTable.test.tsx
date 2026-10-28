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

  it('sorts vehicles between highest distance and vehicle ID on sort button click', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 10.0,
        max_speed_kmh: 60,
        avg_speed_kmh: 20,
        active_minutes: 30,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 35.0,
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

    // Toggle sort button -> id-asc (EV-01 first, EV-02 second)
    const sortBtn = screen.getByRole('button', { name: /toggle sort/i });
    fireEvent.click(sortBtn);

    vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-01');
    expect(vehicleItems[1]).toHaveTextContent('EV-02');

    // Toggle again -> back to distance-desc (EV-02 first, EV-01 second)
    fireEvent.click(sortBtn);
    vehicleItems = screen.getAllByTestId('vehicle-id-cell');
    expect(vehicleItems[0]).toHaveTextContent('EV-02');
    expect(vehicleItems[1]).toHaveTextContent('EV-01');
  });

  it('filters vehicles by search query and status pills', () => {
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
      'shuttle-cm-02': {
        vehicle_id: 'shuttle-cm-02',
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
          'EV-01': now - 2000, // Live
          'shuttle-cm-02': now - 30000, // Offline
        }}
        selectedVehicleId={null}
        onOpenVehicleMap={vi.fn()}
        now={now}
      />
    );

    // Both vehicles initially present
    expect(screen.getAllByText('EV-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('shuttle-cm-02').length).toBeGreaterThan(0);

    // Filter by search query: "cm-02"
    const searchInput = screen.getByPlaceholderText(/search vehicle/i);
    fireEvent.change(searchInput, { target: { value: 'cm-02' } });

    expect(screen.queryByTestId('vehicle-row-EV-01')).toBeNull();
    expect(screen.getByTestId('vehicle-row-shuttle-cm-02')).toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearBtn);
    expect(screen.getByTestId('vehicle-row-EV-01')).toBeInTheDocument();

    // Filter by status dropdown: Live (only EV-01 should be visible)
    const statusMenuBtn = screen.getByRole('button', { name: /filter by status/i });
    fireEvent.click(statusMenuBtn);

    const liveOption = screen.getByRole('button', { name: /^live/i });
    fireEvent.click(liveOption);
    expect(screen.getByTestId('vehicle-row-EV-01')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-row-shuttle-cm-02')).toBeNull();

    // Re-open status dropdown and select: Signal Lost (only shuttle-cm-02 should be visible)
    fireEvent.click(statusMenuBtn);
    const offlineOption = screen.getByRole('button', { name: /^signal lost/i });
    fireEvent.click(offlineOption);
    expect(screen.queryByTestId('vehicle-row-EV-01')).toBeNull();
    expect(screen.getByTestId('vehicle-row-shuttle-cm-02')).toBeInTheDocument();
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

  it('renders vehicle count in header and does not render redundant total distance or max speed cards', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 12.5,
        max_speed_kmh: 42.0,
        avg_speed_kmh: 22.0,
        active_minutes: 65,
        last_updated_at: new Date().toISOString(),
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        date: '2026-10-26',
        total_distance_km: 25.5,
        max_speed_kmh: 58.0,
        avg_speed_kmh: 30.0,
        active_minutes: 120,
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

    // Header badge
    expect(screen.getByText('2 vehicles')).toBeInTheDocument();

    // Confirms total distance and max speed summary cards are removed
    expect(screen.queryByText('Total Distance')).toBeNull();
    expect(screen.queryByText('Max Speed')).toBeNull();
    expect(screen.queryByText('Tracked Shuttles')).toBeNull();

    // Table rows still display each vehicle's distance and active time
    expect(screen.getAllByText('12.50 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25.50 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1h 5m').length).toBeGreaterThan(0);
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

  it('renders mobile card with today distance and active time without max speed', () => {
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
    expect(mobileCard).toHaveTextContent('1h 15m');
    expect(mobileCard).not.toHaveTextContent('48.0 km/h');
  });
});
