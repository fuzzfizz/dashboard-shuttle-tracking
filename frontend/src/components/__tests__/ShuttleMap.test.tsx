import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShuttleMap } from '../ShuttleMap';
import { FleetMap } from '../../types/telemetry';

describe('ShuttleMap', () => {
  it('renders map container without crashing', () => {
    const { container } = render(<ShuttleMap vehicles={{}} selectedVehicleId={null} />);
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('renders with multiple vehicles provided', () => {
    const vehicles: FleetMap = {
      'EV-01': {
        vehicle_id: 'EV-01',
        lat: 13.7563,
        lng: 100.5018,
        speed: 25.5,
        heading: 90,
        timestamp: 1713600000000,
      },
      'EV-02': {
        vehicle_id: 'EV-02',
        lat: 13.7600,
        lng: 100.5100,
        speed: 15.0,
        heading: 180,
        timestamp: 1713600000000,
      },
    };
    const { container } = render(
      <ShuttleMap vehicles={vehicles} selectedVehicleId={null} onSelectVehicle={vi.fn()} />
    );
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('maintains backward compatibility with telemetry prop', () => {
    const telemetry = {
      vehicle_id: 'EV-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 25.5,
      heading: 90,
      timestamp: 1713600000000,
    };
    const { container } = render(<ShuttleMap telemetry={telemetry} />);
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });
});
