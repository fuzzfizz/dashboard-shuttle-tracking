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

  it('renders analytics chart card without executive KPI stat cards, focusing on charts', () => {
    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
      />
    );

    // Header title
    expect(screen.getByText('กราฟวิเคราะห์การเดินรถ')).toBeInTheDocument();
    // Executive KPI stat cards are removed as requested
    expect(screen.queryByText('ระยะทางรวมวันนี้')).toBeNull();
    expect(screen.queryByText('เฉลี่ยต่อคัน')).toBeNull();
    expect(screen.queryByText('คันที่วิ่งมากสุด')).toBeNull();
    expect(screen.queryByText('เวลาวิ่งสะสมรวม')).toBeNull();
    // Default chart: By vehicle comparison
    expect(screen.getAllByText(/BUS-01/i).length).toBeGreaterThanOrEqual(1);
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

  it('renders Vehicle Selector with all options and allows vehicle selection', () => {
    const mockPastRecords = [
      { vehicle_id: 'BUS-03', date: '2026-11-04', total_distance_km: 25.0, active_minutes: 60 },
    ];

    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
        past7DayRecords={mockPastRecords}
      />
    );

    // Vehicle selector exists with accessible label
    const selector = screen.getByRole('combobox', { name: /เลือกคันรถสำหรับดูกราฟ/i });
    expect(selector).toBeInTheDocument();

    // Options exist: 'all', 'BUS-01', 'BUS-02', 'BUS-03'
    expect(screen.getByRole('option', { name: /ทุกคัน \(รวมกองรถ\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /BUS-01/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /BUS-02/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /BUS-03/i })).toBeInTheDocument();
  });

  it('filters 7-day trend and hourly activity to selected vehicle', () => {
    const mockPastRecords = [
      { vehicle_id: 'BUS-01', date: '2026-11-04', total_distance_km: 20.0, active_minutes: 60 },
      { vehicle_id: 'BUS-02', date: '2026-11-04', total_distance_km: 15.0, active_minutes: 45 },
    ];
    const mockHourlyMap = {
      'BUS-01': { 8: 12.0, 17: 8.0 },
      'BUS-02': { 8: 5.0, 17: 10.0 },
    };

    render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
        past7DayRecords={mockPastRecords}
        hourlyDistanceMap={mockHourlyMap}
      />
    );

    const selector = screen.getByRole('combobox', { name: /เลือกคันรถสำหรับดูกราฟ/i });
    fireEvent.change(selector, { target: { value: 'BUS-01' } });

    // Switch to 7-Day Trend tab
    const trendTabBtn = screen.getByRole('button', { name: /7 วัน/i });
    fireEvent.click(trendTabBtn);
    expect(screen.getByText(/ปริมาณระยะทางสะสมของ BUS-01/i)).toBeInTheDocument();

    // Switch to Hourly Activity tab
    const hourlyTabBtn = screen.getByRole('button', { name: /รายชั่วโมง/i });
    fireEvent.click(hourlyTabBtn);
    expect(screen.getByText(/แสดงความหนาแน่นการวิ่งของ BUS-01/i)).toBeInTheDocument();
  });

  it('highlights the selected vehicle row in VehicleComparisonChart', () => {
    const { container } = render(
      <FleetDistanceAnalyticsCard
        dailyMetrics={mockDailyMetrics}
        vehicles={mockVehicles}
        lastSeenMap={{}}
      />
    );

    const selector = screen.getByRole('combobox', { name: /เลือกคันรถสำหรับดูกราฟ/i });
    fireEvent.change(selector, { target: { value: 'BUS-01' } });

    // Selected vehicle row should have data-selected="true"
    const selectedRow = container.querySelector('[data-selected="true"]');
    expect(selectedRow).not.toBeNull();
    expect(selectedRow).toHaveTextContent('BUS-01');
  });
});
