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
});
