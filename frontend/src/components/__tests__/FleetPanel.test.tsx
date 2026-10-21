import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FleetPanel } from '../FleetPanel';
import { FleetMap } from '../../types/telemetry';

describe('FleetPanel', () => {
  const mockFleet: FleetMap = {
    'shuttle-01': {
      vehicle_id: 'shuttle-01',
      lat: 13.75,
      lng: 100.5,
      speed: 32.5,
      heading: 90,
      timestamp: 1000,
    },
    'shuttle-02': {
      vehicle_id: 'shuttle-02',
      lat: 13.76,
      lng: 100.51,
      speed: 0.0,
      heading: 180,
      timestamp: 1000,
    },
  };

  const lastSeenMap = {
    'shuttle-01': Date.now(),
    'shuttle-02': Date.now(),
  };

  it('renders vehicle list correctly', () => {
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={null}
        onSelectVehicle={vi.fn()}
      />
    );

    expect(screen.getByText('shuttle-01')).toBeDefined();
    expect(screen.getByText('shuttle-02')).toBeDefined();
    expect(screen.getByText('32.5 km/h')).toBeDefined();
  });

  it('triggers onSelectVehicle when vehicle card is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={null}
        onSelectVehicle={onSelect}
      />
    );

    fireEvent.click(screen.getByText('shuttle-01'));
    expect(onSelect).toHaveBeenCalledWith('shuttle-01');
  });

  it('triggers onSelectVehicle(null) when overview button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId="shuttle-01"
        onSelectVehicle={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /all vehicles|overview/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders empty state when no vehicles are present', () => {
    render(
      <FleetPanel
        vehicles={{}}
        lastSeenMap={{}}
        selectedVehicleId={null}
        onSelectVehicle={vi.fn()}
      />
    );

    expect(screen.getByText('0 vehicles active')).toBeDefined();
    expect(screen.getByText('Listening for vehicles...')).toBeDefined();
  });

  it('collapses and expands when toggle button is clicked', () => {
    render(
      <FleetPanel
        vehicles={mockFleet}
        lastSeenMap={lastSeenMap}
        selectedVehicleId={null}
        onSelectVehicle={vi.fn()}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /collapse panel/i });
    expect(screen.getByText('shuttle-01')).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.queryByText('shuttle-01')).toBeNull();

    const expandBtn = screen.getByRole('button', { name: /expand panel/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText('shuttle-01')).toBeDefined();
  });
});
