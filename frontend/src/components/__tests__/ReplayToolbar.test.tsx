import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayToolbar } from '../ReplayToolbar';
import {
  getBangkokDate,
  getBangkokMinRetentionDate,
  shiftBangkokDate,
} from '../../services/historicalDateUtils';

describe('ReplayToolbar', () => {
  const vehicles = [
    { id: 'shuttle-01', name: 'Shuttle 1' },
    { id: 'shuttle-02', name: 'Shuttle 2' },
  ];

  const defaultSummary = {
    vehicle_id: 'shuttle-01',
    date: '2026-10-28',
    total_distance_km: 24.8,
    max_speed_kmh: 45.2,
    avg_speed_kmh: 22.1,
    total_points: 1420,
    start_time: '2026-10-28T01:00:00Z',
    end_time: '2026-10-28T10:00:00Z',
  };

  it('renders date picker, vehicle selector, and summary stats', () => {
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('2026-10-28')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Shuttle 1')).toBeInTheDocument();
    expect(screen.getByText(/24.8/)).toBeInTheDocument();
    expect(screen.getByText(/1,420 จุด/)).toBeInTheDocument();
  });

  it('triggers onDateChange when date is modified', () => {
    const onDateChange = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={onDateChange}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByDisplayValue('2026-10-28'), {
      target: { value: '2026-10-27' },
    });
    expect(onDateChange).toHaveBeenCalledWith('2026-10-27');
  });

  it('triggers onVehicleChange when vehicle selection changes', () => {
    const onVehicleChange = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={onVehicleChange}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'shuttle-02' },
    });
    expect(onVehicleChange).toHaveBeenCalledWith('shuttle-02');
  });

  it('triggers onRefresh on refresh button click', () => {
    const onRefresh = vi.fn();
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /รีเฟรช/i }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('sets min and max attributes properly for 14-day retention', () => {
    const minDate = getBangkokMinRetentionDate(14);
    const maxDate = getBangkokDate();

    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const dateInput = screen.getByLabelText('Select Date');
    expect(dateInput).toHaveAttribute('min', minDate);
    expect(dateInput).toHaveAttribute('max', maxDate);
  });

  it('navigates to previous and next day when clicking step buttons', () => {
    const onDateChange = vi.fn();
    const minDate = getBangkokMinRetentionDate(14);
    const maxDate = getBangkokDate();
    const currentDate = shiftBangkokDate(maxDate, -2, minDate, maxDate);

    render(
      <ReplayToolbar
        selectedDate={currentDate}
        onDateChange={onDateChange}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const prevButton = screen.getByRole('button', { name: 'วันก่อนหน้า' });
    const nextButton = screen.getByRole('button', { name: 'วันถัดไป' });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    expect(onDateChange).toHaveBeenCalledWith(shiftBangkokDate(currentDate, -1, minDate, maxDate));

    fireEvent.click(nextButton);
    expect(onDateChange).toHaveBeenCalledWith(shiftBangkokDate(currentDate, 1, minDate, maxDate));
  });

  it('disables previous day button when at minDate and next day button when at maxDate', () => {
    const minDate = getBangkokMinRetentionDate(14);
    const maxDate = getBangkokDate();

    const { rerender } = render(
      <ReplayToolbar
        selectedDate={minDate}
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'วันก่อนหน้า' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'วันถัดไป' })).not.toBeDisabled();

    rerender(
      <ReplayToolbar
        selectedDate={maxDate}
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'วันถัดไป' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'วันก่อนหน้า' })).not.toBeDisabled();
  });


  it('renders 14-day retention label and summary metrics including max speed', () => {
    render(
      <ReplayToolbar
        selectedDate="2026-10-28"
        onDateChange={vi.fn()}
        selectedVehicleId="shuttle-01"
        onVehicleChange={vi.fn()}
        vehicleList={vehicles}
        summary={defaultSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('บันทึกย้อนหลัง 14 วัน')).toBeInTheDocument();
    expect(screen.getByText(/45.2 กม.\/ชม./)).toBeInTheDocument();
  });
});
