import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapContainer } from 'react-leaflet';
import { TripRouteOverlay, createPinIcon } from '../TripRouteOverlay';
import { VehicleTrip } from '../../types/trip';

let mapEventHandlers: Record<string, Function> = {};

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="leaflet-map-container">{children}</div>,
  Polyline: (props: any) => (
    <div
      data-testid={props['data-testid']}
      data-color={props.pathOptions?.color}
      data-dash={props.pathOptions?.dashArray}
    />
  ),
  Marker: (props: any) => (
    <div
      data-testid={props['data-testid']}
      data-lat={props.position?.[0]}
      data-lng={props.position?.[1]}
    />
  ),
  useMapEvents: (handlers: any) => {
    mapEventHandlers = handlers;
    return null;
  },
}));

describe('TripRouteOverlay', () => {
  beforeEach(() => {
    mapEventHandlers = {};
  });

  const mockTrip: VehicleTrip = {
    vehicleId: 'EV-01',
    pickup: { lat: 18.7883, lng: 98.9853, name: 'Faculty of Pharmacy' },
    dropoff: { lat: 18.7900, lng: 98.9900, name: 'Maharaj Hospital' },
    plannedPath: [
      [18.7883, 98.9853],
      [18.7890, 98.9875],
      [18.7900, 98.9900],
    ],
    createdAt: Date.now(),
  };

  it('renders Planned Route and pin markers when trip is provided', () => {
    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay trip={mockTrip} actualPath={[[18.7883, 98.9853], [18.7885, 98.9860]]} />
      </MapContainer>
    );

    expect(screen.getByTestId('planned-route-polyline')).toBeInTheDocument();
    expect(screen.getByTestId('actual-path-polyline')).toBeInTheDocument();
    expect(screen.getByTestId('pickup-marker')).toBeInTheDocument();
    expect(screen.getByTestId('dropoff-marker')).toBeInTheDocument();
  });

  it('renders alternative route branches with overlapping sections hidden', () => {
    const tripWithAlt: VehicleTrip = {
      ...mockTrip,
      alternativePaths: [
        [
          [18.7840, 98.9860],
          [18.7860, 98.9870],
        ],
      ],
    };

    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay trip={tripWithAlt} />
      </MapContainer>
    );

    expect(screen.getByTestId('alt-route-polyline-0')).toBeInTheDocument();
  });

  it('renders nothing when no trip or actual path is provided and pinMode is idle', () => {
    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay pinMode="idle" />
      </MapContainer>
    );

    expect(screen.queryByTestId('planned-route-polyline')).toBeNull();
    expect(screen.queryByTestId('pickup-marker')).toBeNull();
  });

  it('handles map clicks when pinMode is active', () => {
    const onMapClick = vi.fn();
    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay pinMode="pick-pickup" onMapClick={onMapClick} />
      </MapContainer>
    );

    expect(mapEventHandlers.click).toBeDefined();
    mapEventHandlers.click({ latlng: { lat: 18.7885, lng: 98.9855 } });
    expect(onMapClick).toHaveBeenCalledWith(18.7885, 98.9855);
  });

  it('ignores map clicks when pinMode is idle', () => {
    const onMapClick = vi.fn();
    render(
      <MapContainer center={[18.7883, 98.9853]} zoom={15}>
        <TripRouteOverlay pinMode="idle" onMapClick={onMapClick} />
      </MapContainer>
    );

    if (mapEventHandlers.click) {
      mapEventHandlers.click({ latlng: { lat: 18.7885, lng: 98.9855 } });
    }
    expect(onMapClick).not.toHaveBeenCalled();
  });

  it('creates custom pin icon with correct label and color', () => {
    const pickupIcon = createPinIcon('pickup', 'Pharmacy');
    expect(pickupIcon.options.html).toContain('Pharmacy');
    expect(pickupIcon.options.html).toContain('#4a7c0b');

    const dropoffIcon = createPinIcon('dropoff', 'Hospital');
    expect(dropoffIcon.options.html).toContain('Hospital');
    expect(dropoffIcon.options.html).toContain('#dc2626');
  });
});
