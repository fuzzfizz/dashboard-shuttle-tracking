import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FleetDistanceAnalyticsCard } from '../FleetDistanceAnalyticsCard';
import { DailyMetricsMap } from '../../types/metrics';
import { FleetMap } from '../../types/telemetry';
import * as historicalService from '../../services/historicalTelemetryService';

describe('FleetDistanceAnalyticsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
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
    expect(screen.getByText('สถิติระยะทางวิ่ง')).toBeInTheDocument();
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

    // Switch to Week timeframe and click 7-Day Trend tab
    fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
    const trendTabBtn = screen.getByRole('button', { name: /7 วัน/i });
    fireEvent.click(trendTabBtn);
    expect(screen.getByText(/ปริมาณระยะทางสะสมของกองรถ/i)).toBeInTheDocument();

    // Switch back to Today timeframe and click Hourly Activity tab
    fireEvent.click(screen.getByRole('button', { name: 'วันนี้' }));
    const hourlyTabBtn = screen.getByRole('button', { name: /รายชั่วโมง/i });
    fireEvent.click(hourlyTabBtn);
    expect(screen.getByText(/แสดงความหนาแน่นการวิ่งตลอดวัน/i)).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /เปรียบเทียบรายคัน/i })).toBeNull();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /เปรียบเทียบรายคัน/i })).toBeInTheDocument();
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

    // Switch to Week timeframe and click 7-Day Trend tab
    fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
    const trendTabBtn = screen.getByRole('button', { name: /7 วัน/i });
    fireEvent.click(trendTabBtn);
    expect(screen.getByText(/ปริมาณระยะทางสะสมของ BUS-01/i)).toBeInTheDocument();

    // Switch to Today timeframe and click Hourly Activity tab
    fireEvent.click(screen.getByRole('button', { name: 'วันนี้' }));
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

  describe('Timeframe Selector & Dynamic Tabs (Task 4)', () => {
    it('renders 4 timeframe buttons (วันนี้, สัปดาห์, เดือน, ปี) with วันนี้ pressed by default', () => {
      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      const todayBtn = screen.getByRole('button', { name: 'วันนี้' });
      const weekBtn = screen.getByRole('button', { name: 'สัปดาห์' });
      const monthBtn = screen.getByRole('button', { name: 'เดือน' });
      const yearBtn = screen.getByRole('button', { name: 'ปี' });

      expect(todayBtn).toBeInTheDocument();
      expect(weekBtn).toBeInTheDocument();
      expect(monthBtn).toBeInTheDocument();
      expect(yearBtn).toBeInTheDocument();

      expect(todayBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weekBtn).toHaveAttribute('aria-pressed', 'false');
      expect(monthBtn).toHaveAttribute('aria-pressed', 'false');
      expect(yearBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches active timeframe and toggles aria-pressed when timeframe buttons are clicked', () => {
      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      const todayBtn = screen.getByRole('button', { name: 'วันนี้' });
      const weekBtn = screen.getByRole('button', { name: 'สัปดาห์' });
      const monthBtn = screen.getByRole('button', { name: 'เดือน' });
      const yearBtn = screen.getByRole('button', { name: 'ปี' });

      fireEvent.click(weekBtn);
      expect(todayBtn).toHaveAttribute('aria-pressed', 'false');
      expect(weekBtn).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(monthBtn);
      expect(weekBtn).toHaveAttribute('aria-pressed', 'false');
      expect(monthBtn).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(yearBtn);
      expect(monthBtn).toHaveAttribute('aria-pressed', 'false');
      expect(yearBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('dynamically updates Tab 2 label according to active timeframe', () => {
      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      // 1. Today: Tab 2 is กิจกรรมรายชั่วโมง
      expect(screen.getByRole('button', { name: /กิจกรรมรายชั่วโมง/i })).toBeInTheDocument();

      // 2. Week: Tab 2 is แนวโน้ม 7 วัน
      fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
      expect(screen.getByRole('button', { name: /แนวโน้ม 7 วัน/i })).toBeInTheDocument();

      // 3. Month: Tab 2 is แนวโน้ม 30 วัน
      fireEvent.click(screen.getByRole('button', { name: 'เดือน' }));
      expect(screen.getByRole('button', { name: /แนวโน้ม 30 วัน/i })).toBeInTheDocument();

      // 4. Year: Tab 2 is แนวโน้ม 12 เดือน
      fireEvent.click(screen.getByRole('button', { name: 'ปี' }));
      expect(screen.getByRole('button', { name: /แนวโน้ม 12 เดือน/i })).toBeInTheDocument();
    });

    it('preserves active tab state when switching between timeframes', () => {
      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      // Click Tab 2 (Hourly Activity under 'today')
      const hourlyTabBtn = screen.getByRole('button', { name: /กิจกรรมรายชั่วโมง/i });
      fireEvent.click(hourlyTabBtn);
      expect(screen.getByText(/แสดงความหนาแน่นการวิ่งตลอดวัน/i)).toBeInTheDocument();

      // Switch to 'week' timeframe - Tab 2 remains active and displays Trend7DayChart
      fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
      expect(screen.getByText(/ปริมาณระยะทางสะสมของกองรถ/i)).toBeInTheDocument();

      // Switch back to 'vehicles' tab (Tab 1)
      fireEvent.click(screen.getByRole('button', { name: /เปรียบเทียบรายคัน/i }));
      expect(screen.getByText(/ระยะทางรถแต่ละคัน/i)).toBeInTheDocument();

      // Switch to 'month' timeframe - Tab 1 remains active on vehicle comparison
      fireEvent.click(screen.getByRole('button', { name: 'เดือน' }));
      expect(screen.getByText(/ระยะทางรถแต่ละคัน/i)).toBeInTheDocument();
    });

    it('fetches 30-day records on demand when switching to month and caches the result', async () => {
      const mock30DayRecords = [
        { vehicle_id: 'BUS-01', date: '2026-10-25', total_distance_km: 60.0 },
        { vehicle_id: 'BUS-02', date: '2026-10-26', total_distance_km: 40.0 },
      ];
      const fetchSpy = vi
        .spyOn(historicalService, 'fetchTimeframeVehicleMetrics')
        .mockResolvedValue(mock30DayRecords);

      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      // Switch to 'month'
      fireEvent.click(screen.getByRole('button', { name: 'เดือน' }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('month', expect.anything());
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Switch to 'week' and back to 'month' - should use cache and not fetch again
      fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
      fireEvent.click(screen.getByRole('button', { name: 'เดือน' }));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('fetches 12-month records on demand when switching to year and updates vehicle comparison benchmark', async () => {
      // BUS-01: today (45) + past 100 = 145 km
      // BUS-02: today (35) + past 50 = 85 km
      // Average fleet = (145 + 85) / 2 = 115.0 km
      const mock12MonthRecords = [
        { vehicle_id: 'BUS-01', date: '2026-06-15', total_distance_km: 100.0 },
        { vehicle_id: 'BUS-02', date: '2026-06-15', total_distance_km: 50.0 },
      ];
      const fetchSpy = vi
        .spyOn(historicalService, 'fetchTimeframeVehicleMetrics')
        .mockResolvedValue(mock12MonthRecords);

      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'ปี' }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('year', expect.anything());
      });

      // Benchmark text should reflect updated fleet average: (145 + 85) / 2 = 115.0 km
      await waitFor(() => {
        expect(screen.getByText(/ค่าเฉลี่ยฟลีต \(115\.0 km\)/i)).toBeInTheDocument();
      });
    });

    it('uses past7DayRecords for week cache without making an external fetch', () => {
      const mockPast7DayRecords = [
        { vehicle_id: 'BUS-01', date: '2026-11-04', total_distance_km: 20.0 },
      ];
      const fetchSpy = vi.spyOn(historicalService, 'fetchTimeframeVehicleMetrics');

      render(
        <FleetDistanceAnalyticsCard
          dailyMetrics={mockDailyMetrics}
          vehicles={mockVehicles}
          lastSeenMap={{}}
          past7DayRecords={mockPast7DayRecords}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'สัปดาห์' }));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
