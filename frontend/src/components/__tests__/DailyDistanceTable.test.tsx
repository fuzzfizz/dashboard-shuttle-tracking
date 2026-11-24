import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyDistanceTable, LicensePlateBadge, convertDistance, formatDistance } from '../DailyDistanceTable';
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
    expect(screen.getByText(/ยังไม่มีบันทึกระยะทางวันนี้|no distance recorded today/i)).toBeInTheDocument();
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

    expect(screen.getAllByText('EV-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('18.50 km').length).toBeGreaterThan(0);

    // Verify percent bar and percentage labels are NOT rendered
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/progress vs/i)).toBeNull();

    // Click open button
    const openBtn = screen.getByRole('button', { name: /open map for ev-01/i });
    fireEvent.click(openBtn);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('does not trigger onOpenVehicleMap when clicking desktop row, only on Open Map button', () => {
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
    expect(handleOpenMap).not.toHaveBeenCalled();

    const openBtn = screen.getByRole('button', { name: /open map for ev-01/i });
    fireEvent.click(openBtn);
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
    const searchInput = screen.getByPlaceholderText(/ค้นหาหมายเลขรถ/i);
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

    const liveOption = screen.getByRole('button', { name: /ออนไลน์|live/i });
    fireEvent.click(liveOption);
    expect(screen.getByTestId('vehicle-row-EV-01')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-row-shuttle-cm-02')).toBeNull();

    // Re-open status dropdown and select: Signal Lost (only shuttle-cm-02 should be visible)
    fireEvent.click(statusMenuBtn);
    const offlineOption = screen.getByRole('button', { name: /ขาดสัญญาณ|signal lost/i });
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

    expect(screen.getAllByText(/ออนไลน์|Live/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/ขาดสัญญาณ|Signal Lost/)[0]).toBeInTheDocument();
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
    expect(screen.getByText(/2 คัน|2 vehicles/)).toBeInTheDocument();

    // Confirms total distance and max speed summary cards are removed
    expect(screen.queryByText('Total Distance')).toBeNull();
    expect(screen.queryByText('Max Speed')).toBeNull();
    expect(screen.queryByText('Tracked Shuttles')).toBeNull();

    // Table rows still display each vehicle's distance and last seen header
    expect(screen.getAllByText('12.50 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25.50 km').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: /อัปเดตล่าสุด/i })).toBeInTheDocument();
  });

  it('handles mobile card clicks only via action button with accessible min-h-[44px] targets', () => {
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
    // Clicking the card body should not trigger map open
    fireEvent.click(mobileCard);
    expect(handleOpenMap).not.toHaveBeenCalled();

    // Clicking the Open Map action button on the mobile card triggers map open
    const openBtn = screen.getByRole('button', { name: /view map for ev-01/i });
    expect(openBtn.className).toContain('min-h-[44px]');
    fireEvent.click(openBtn);
    expect(handleOpenMap).toHaveBeenCalledWith('EV-01');
  });

  it('renders mobile card with today distance and last seen without max speed', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 15.5,
        max_speed_kmh: 48.0,
        avg_speed_kmh: 24.0,
        active_minutes: 75,
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
    expect(mobileCard).toHaveTextContent(/อัปเดตล่าสุด/);
    expect(mobileCard).not.toHaveTextContent('48.0 km/h');
  });

  it('renders license plate badge for vehicle ID in both desktop and mobile views', () => {
    const metrics: DailyMetricsMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        date: '2026-10-26',
        total_distance_km: 15.5,
        max_speed_kmh: 48.0,
        avg_speed_kmh: 24.0,
        active_minutes: 75,
        last_updated_at: new Date().toISOString(),
      },
    };

    render(
      <DailyDistanceTable
        dailyMetrics={metrics}
        vehicles={{}}
        lastSeenMap={{ 'EV-01': Date.now() }}
        selectedVehicleId="EV-01"
        onOpenVehicleMap={vi.fn()}
      />
    );

    // Both desktop row and mobile card should render LicensePlateBadge
    const badges = screen.getAllByTestId('license-plate-badge');
    expect(badges.length).toBeGreaterThanOrEqual(2);
    badges.forEach((badge) => {
      expect(badge).toHaveTextContent('EV-01');
      expect(badge).toHaveAttribute('title', 'ป้ายทะเบียน: EV-01');
      expect(badge.className).toContain('border-[#4a7c0b]');
    });
  });

  describe('LicensePlateBadge', () => {
    it('renders normal unselected plate badge', () => {
      render(<LicensePlateBadge plateNumber="1กก-9999" isSelected={false} />);
      const badge = screen.getByTestId('license-plate-badge');
      expect(badge).toHaveTextContent('1กก-9999');
      expect(badge.className).toContain('border-slate-800');
    });

    it('renders selected plate badge with brand olive green border and ring', () => {
      render(<LicensePlateBadge plateNumber="EV-CMU-01" isSelected={true} />);
      const badge = screen.getByTestId('license-plate-badge');
      expect(badge).toHaveTextContent('EV-CMU-01');
      expect(badge.className).toContain('border-[#4a7c0b]');
      expect(badge.className).toContain('ring-[#5c990e]/35');
    });
  });

  describe('Distance Unit Switching (km <-> mile)', () => {
    it('converts and formats distance correctly between km and mile', () => {
      expect(convertDistance(10, 'km')).toBe(10);
      expect(convertDistance(10, 'mile')).toBeCloseTo(6.2137, 3);

      expect(formatDistance(10, 'km')).toBe('10.00 km');
      expect(formatDistance(10, 'mile')).toBe('6.21 mile');
      expect(formatDistance(18.5, 'mile')).toBe('11.50 mile');
    });

    it('toggles distance display between km and mile via header unit switch buttons', () => {
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
          lastSeenMap={{}}
          selectedVehicleId={null}
          onOpenVehicleMap={vi.fn()}
        />
      );

      // Default unit is km
      expect(screen.getAllByText('18.50 km').length).toBeGreaterThan(0);

      // Click mile button
      const mileBtn = screen.getByTestId('unit-mile-btn');
      fireEvent.click(mileBtn);

      // Now displayed in miles (18.5 km ~ 11.50 mile)
      expect(screen.getAllByText('11.50 mile').length).toBeGreaterThan(0);
      expect(screen.queryByText('18.50 km')).toBeNull();

      // Click km button to switch back
      const kmBtn = screen.getByTestId('unit-km-btn');
      fireEvent.click(kmBtn);
      expect(screen.getAllByText('18.50 km').length).toBeGreaterThan(0);
      expect(screen.queryByText('11.50 mile')).toBeNull();
    });

    it('toggles unit when clicking the table header column for distance', () => {
      const metrics: DailyMetricsMap = {
        'EV-01': {
          vehicle_id: 'EV-01',
          date: '2026-10-26',
          total_distance_km: 35.0,
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
          lastSeenMap={{}}
          selectedVehicleId={null}
          onOpenVehicleMap={vi.fn()}
        />
      );

      expect(screen.getAllByText('35.00 km').length).toBeGreaterThan(0);

      // Column header has title "คลิกเพื่อสลับหน่วยระหว่าง km และ mile"
      const colHeader = screen.getByTitle(/คลิกเพื่อสลับหน่วยระหว่าง km และ mile/i);
      fireEvent.click(colHeader);

      // 35 km * 0.621371 = 21.75 mile
      expect(screen.getAllByText('21.75 mile').length).toBeGreaterThan(0);
    });

    it('calls onDistanceUnitChange when controlled props are provided', () => {
      const handleUnitChange = vi.fn();
      const metrics: DailyMetricsMap = {
        'EV-01': {
          vehicle_id: 'EV-01',
          date: '2026-10-26',
          total_distance_km: 10.0,
          max_speed_kmh: 40,
          avg_speed_kmh: 20,
          active_minutes: 30,
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
          distanceUnit="mile"
          onDistanceUnitChange={handleUnitChange}
        />
      );

      // Rendered in miles initially because distanceUnit="mile"
      expect(screen.getAllByText('6.21 mile').length).toBeGreaterThan(0);

      // Click km button
      const kmBtn = screen.getByTestId('unit-km-btn');
      fireEvent.click(kmBtn);
      expect(handleUnitChange).toHaveBeenCalledWith('km');
    });
  });

  describe('Last Seen & Cross-Day Display (Task 2)', () => {
    it('renders "อัปเดตล่าสุด" in table header instead of "เวลาวิ่งสะสม"', () => {
      render(
        <DailyDistanceTable
          dailyMetrics={{}}
          vehicles={{ 'BUS-01': { vehicle_id: 'BUS-01', lat: 18.7, lng: 98.9, speed: 10, timestamp: Date.now() } }}
          lastSeenMap={{ 'BUS-01': Date.now() }}
          selectedVehicleId={null}
          onOpenVehicleMap={vi.fn()}
        />
      );

      expect(screen.getByRole('columnheader', { name: /อัปเดตล่าสุด/i })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /เวลาวิ่งสะสม/i })).toBeNull();
    });

    it('renders today time and "เมื่อสักครู่" for vehicles updated recently today', () => {
      const now = new Date('2026-11-19T07:00:00Z').getTime(); // 14:00 Bangkok
      render(
        <DailyDistanceTable
          dailyMetrics={{}}
          vehicles={{ 'BUS-01': { vehicle_id: 'BUS-01', lat: 18.7, lng: 98.9, speed: 10, timestamp: now - 10000 } }}
          lastSeenMap={{ 'BUS-01': now - 10000 }}
          selectedVehicleId={null}
          onOpenVehicleMap={vi.fn()}
          now={now}
        />
      );

      expect(screen.getAllByText(/13:59 น\.|14:00 น\./i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/เมื่อสักครู่/i).length).toBeGreaterThan(0);
    });

    it('renders "วันนี้ยังไม่มีการเดินทาง" and contextual last seen when vehicle last reported yesterday', () => {
      const now = new Date('2026-11-19T07:00:00Z').getTime();
      const yesterday = new Date('2026-11-18T10:30:00Z').getTime(); // 17:30 Bangkok yesterday
      render(
        <DailyDistanceTable
          dailyMetrics={{}}
          vehicles={{ 'BUS-02': { vehicle_id: 'BUS-02', lat: 18.7, lng: 98.9, speed: 0, timestamp: yesterday } }}
          lastSeenMap={{ 'BUS-02': yesterday }}
          selectedVehicleId={null}
          onOpenVehicleMap={vi.fn()}
          now={now}
        />
      );

      expect(screen.getAllByText(/วันนี้ยังไม่มีการเดินทาง/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/พบล่าสุด: เมื่อวาน 17:30 น\./i).length).toBeGreaterThan(0);
    });
  });
});
