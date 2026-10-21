import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyMetricsModal } from '../DailyMetricsModal';
import { DailyMetricsMap } from '../../types/metrics';

describe('DailyMetricsModal', () => {
  const mockDailyMetrics: DailyMetricsMap = {
    'shuttle-01': {
      vehicle_id: 'shuttle-01',
      date: '2026-10-21',
      total_distance_km: 15.42,
      max_speed_kmh: 42.1,
      avg_speed_kmh: 25.0,
      active_minutes: 75,
      last_updated_at: '2026-10-21T10:00:00Z',
    },
    'shuttle-02': {
      vehicle_id: 'shuttle-02',
      date: '2026-10-21',
      total_distance_km: 8.35,
      max_speed_kmh: 30.0,
      avg_speed_kmh: 20.0,
      active_minutes: 45,
      last_updated_at: '2026-10-21T10:00:00Z',
    },
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DailyMetricsModal
        isOpen={false}
        onClose={vi.fn()}
        dailyMetrics={mockDailyMetrics}
        totalFleetDistanceKm={23.77}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders empty breakdown state when no metrics are provided', () => {
    render(
      <DailyMetricsModal
        isOpen={true}
        onClose={vi.fn()}
        dailyMetrics={{}}
        totalFleetDistanceKm={0}
      />
    );

    expect(screen.getByText('Daily Fleet Analytics')).toBeInTheDocument();
    expect(screen.getAllByText('0.0')).toHaveLength(2);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No mileage recorded for today yet. Telemetry will calculate distance as vehicles travel.'
      )
    ).toBeInTheDocument();
  });

  it('renders summary cards and vehicle breakdown correctly', () => {
    render(
      <DailyMetricsModal
        isOpen={true}
        onClose={vi.fn()}
        dailyMetrics={mockDailyMetrics}
        totalFleetDistanceKm={23.77}
      />
    );

    expect(screen.getByText('Daily Fleet Analytics')).toBeInTheDocument();
    expect(screen.getByText('23.8')).toBeInTheDocument();
    expect(screen.getByText('42.1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('shuttle-01')).toBeInTheDocument();
    expect(screen.getByText('15.42 km')).toBeInTheDocument();
    expect(screen.getByText('1h 15m')).toBeInTheDocument();

    expect(screen.getByText('shuttle-02')).toBeInTheDocument();
    expect(screen.getByText('8.35 km')).toBeInTheDocument();
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('triggers onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <DailyMetricsModal
        isOpen={true}
        onClose={onClose}
        dailyMetrics={mockDailyMetrics}
        totalFleetDistanceKm={23.77}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
