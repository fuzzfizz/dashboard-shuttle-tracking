import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FleetDistanceAnalyticsCard } from '../FleetDistanceAnalyticsCard';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';

describe('FleetDistanceAnalyticsCard', () => {
  const mockDailyMetrics: DailyMetricsMap = {
    'BUS-01': {
      vehicle_id: 'BUS-01',
      date: '2026-11-05',
      total_distance_km: 45.0,
      max_speed_kmh: 40,
      avg_speed_kmh: 20,
      active_minutes: 120,
      last_updated_at: '2026-11-05T10:00:00Z',
    },
    'BUS-02': {
      vehicle_id: 'BUS-02',
      date: '2026-11-05',
      total_distance_km: 35.0,
      max_speed_kmh: 35,
      avg_speed_kmh: 18,
      active_minutes: 90,
      last_updated_at: '2026-11-05T10:00:00Z',
    },
  };

  const mockVehicles: FleetMap = {
    'BUS-01': { vehicle_id: 'BUS-01', lat: 18.79, lng: 98.98, speed: 20, timestamp: Date.now() },
    'BUS-02': { vehicle_id: 'BUS-02', lat: 18.80, lng: 98.99, speed: 15, timestamp: Date.now() },
  };

  it('renders all 4 executive KPI highlight cards with accurate values', () => {
    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
      />
    );

    expect(screen.getByText('80.00')).toBeInTheDocument(); // 45 + 35
    expect(screen.getByText('40.00')).toBeInTheDocument(); // Average
    expect(screen.getAllByText(/BUS-01/i).length).toBeGreaterThanOrEqual(1); // Top vehicle and chart
    expect(screen.getByText(/3 ชม. 30 นาที/i)).toBeInTheDocument(); // 210 mins
  });

  it('switches between By Vehicle, 7-Day Trend, and Hourly Activity tabs', () => {
    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
      />
    );

    // Default tab: By Vehicle
    expect(screen.getAllByText('BUS-01').length).toBeGreaterThanOrEqual(1);

    // Click 7-Day Trend tab
    const trendTabBtn = screen.getByRole('button', { name: /7 วัน/i });
    fireEvent.click(trendTabBtn);
    expect(screen.getByText(/ปริมาณระยะทางสะสมของกองรถ/i)).toBeInTheDocument();

    // Click Hourly Activity tab
    const hourlyTabBtn = screen.getByRole('button', { name: /รายชั่วโมง/i });
    fireEvent.click(hourlyTabBtn);
    expect(screen.getByText(/ช่วงเร่งด่วนเช้า/i)).toBeInTheDocument();
  });

  it('toggles collapse and expand when header toggle is clicked', () => {
    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /ย่อการ์ด|ขยายการ์ด/i });
    fireEvent.click(toggleBtn);
    expect(screen.queryByRole('button', { name: /7 วัน/i })).toBeNull();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /7 วัน/i })).toBeInTheDocument();
  });
});
