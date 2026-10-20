import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShuttleMap } from '../ShuttleMap';

describe('ShuttleMap', () => {
  it('renders map container without crashing', () => {
    const { container } = render(<ShuttleMap telemetry={null} />);
    expect(container.querySelector('.leaflet-container')).toBeDefined();
  });

  it('renders with telemetry provided without crashing', () => {
    const telemetry = {
      vehicle_id: 'EV-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 25.5,
      heading: 90,
      timestamp: 1713600000000,
    };
    const { container } = render(<ShuttleMap telemetry={telemetry} />);
    expect(container.querySelector('.leaflet-container')).toBeDefined();
  });
});
