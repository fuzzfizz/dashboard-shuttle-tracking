import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehicleComparisonChart } from '../VehicleComparisonChart';
import { Trend7DayChart } from '../Trend7DayChart';
import { HourlyActivityChart } from '../HourlyActivityChart';

describe('Fleet Sub-Charts', () => {
  it('renders VehicleComparisonChart with bars and fleet average line', () => {
    const items = [
      { vehicleId: 'BUS-01', distanceKm: 40, percentageOfMax: 100, activeMinutes: 120 },
      { vehicleId: 'BUS-02', distanceKm: 20, percentageOfMax: 50, activeMinutes: 60 },
    ];
    render(<VehicleComparisonChart items={items} avgDistanceKm={30} />);
    expect(screen.getByText('BUS-01')).toBeInTheDocument();
    expect(screen.getByText('40.0 km')).toBeInTheDocument();
    expect(screen.getByText('BUS-02')).toBeInTheDocument();
    expect(screen.getByText('20.0 km')).toBeInTheDocument();
    expect(screen.getByText(/ค่าเฉลี่ยฟลีต/i)).toBeInTheDocument();
  });

  it('renders Trend7DayChart with SVG path and day labels', () => {
    const points = [
      { date: '2026-10-30', dayLabel: 'ศ. 30', totalDistanceKm: 50, isToday: false },
      { date: '2026-11-05', dayLabel: 'วันนี้', totalDistanceKm: 80, isToday: true },
    ];
    const { container } = render(<Trend7DayChart points={points} />);
    expect(screen.getByText('ศ. 30')).toBeInTheDocument();
    expect(screen.getByText('วันนี้')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('path')).toBeInTheDocument();
  });

  it('renders HourlyActivityChart with peak commute badges and hours', () => {
    const hours = [
      { hour: 7, hourLabel: '07:00', intensity: 0.9, distanceKm: 12.5, isPeak: true },
      { hour: 12, hourLabel: '12:00', intensity: 0.4, distanceKm: 4.2, isPeak: false },
    ];
    render(<HourlyActivityChart hours={hours} />);
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText(/ช่วงเร่งด่วนเช้า/i)).toBeInTheDocument();
  });

  it('renders charts with vehicle-specific labels and selection highlights', () => {
    const items = [
      { vehicleId: 'BUS-01', distanceKm: 40, percentageOfMax: 100, activeMinutes: 120 },
      { vehicleId: 'BUS-02', distanceKm: 20, percentageOfMax: 50, activeMinutes: 60 },
    ];
    const { container: compContainer } = render(
      <VehicleComparisonChart items={items} avgDistanceKm={30} selectedVehicleId="BUS-01" />
    );
    expect(compContainer.querySelector('[data-selected="true"]')).toHaveTextContent('BUS-01');

    render(
      <Trend7DayChart
        points={[{ date: '2026-11-05', dayLabel: 'วันนี้', totalDistanceKm: 25, isToday: true }]}
        selectedVehicleId="BUS-01"
      />
    );
    expect(screen.getByText('ปริมาณระยะทางสะสมของ BUS-01 (กม./วัน)')).toBeInTheDocument();

    render(
      <HourlyActivityChart
        hours={[{ hour: 8, hourLabel: '08:00', intensity: 0.8, distanceKm: 5, isPeak: true }]}
        selectedVehicleId="BUS-01"
      />
    );
    expect(screen.getByText('แสดงความหนาแน่นการวิ่งของ BUS-01')).toBeInTheDocument();
  });

  it('renders Trend7DayChart with 30 points for monthly trend without overlapping labels', () => {
    const points30 = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      dayLabel: `${i + 1} พ.ย.`,
      totalDistanceKm: 20 + (i % 5) * 5,
      isToday: i === 29,
    }));

    const { container } = render(<Trend7DayChart points={points30} timeframe="month" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('path')).toBeInTheDocument();
    expect(
      screen.getByText('ปริมาณระยะทางสะสมของกองรถ (กม./วัน ย้อนหลัง 30 วัน)')
    ).toBeInTheDocument();
    // Verify decimation: not every single day label is rendered as full text to avoid clutter
    const renderedTexts = screen.getAllByText(/พ.ย.|วันนี้/);
    expect(renderedTexts.length).toBeLessThanOrEqual(10);
    expect(renderedTexts.length).toBeGreaterThanOrEqual(4);
  });

  it('renders Trend7DayChart with 12 points for yearly trend showing monthly labels', () => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const points12 = months.map((m, i) => ({
      date: `2026-${String(i + 1).padStart(2, '0')}-01`,
      dayLabel: m,
      totalDistanceKm: 200 + i * 20,
      isToday: i === 10,
    }));

    render(
      <Trend7DayChart
        points={points12}
        timeframe="year"
        selectedVehicleId="BUS-01"
        vehicleLabel="BUS-01 (Express)"
      />
    );
    expect(screen.getByText('ม.ค.')).toBeInTheDocument();
    expect(screen.getByText('ธ.ค.')).toBeInTheDocument();
    expect(
      screen.getByText('ปริมาณระยะทางสะสมของ BUS-01 (Express) (กม./เดือน ย้อนหลัง 12 เดือน)')
    ).toBeInTheDocument();
  });

  it('renders Trend7DayChart with week timeframe header', () => {
    const points = [
      { date: '2026-11-05', dayLabel: 'วันนี้', totalDistanceKm: 25, isToday: true },
    ];
    render(<Trend7DayChart points={points} timeframe="week" selectedVehicleId="BUS-01" />);
    expect(
      screen.getByText('ปริมาณระยะทางสะสมของ BUS-01 (กม./วัน ย้อนหลัง 7 วัน)')
    ).toBeInTheDocument();
  });
});
