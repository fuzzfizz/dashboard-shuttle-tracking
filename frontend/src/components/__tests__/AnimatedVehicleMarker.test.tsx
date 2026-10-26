import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapContainer } from 'react-leaflet';
import { AnimatedVehicleMarker } from '../AnimatedVehicleMarker';
import { TelemetryPayload } from '../../types/telemetry';

describe('AnimatedVehicleMarker', () => {
  const initialVehicle: TelemetryPayload = {
    vehicle_id: 'shuttle-01',
    lat: 18.7695,
    lng: 98.9759,
    speed: 30.0,
    heading: 90,
    timestamp: 10000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders within a MapContainer without error', () => {
    const { container } = render(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={initialVehicle}
          isSelected={false}
          isOnline={true}
        />
      </MapContainer>
    );

    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('updates position and triggers animation on coordinate change', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    const { rerender } = render(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={initialVehicle}
          isSelected={false}
          isOnline={true}
        />
      </MapContainer>
    );

    const updatedVehicle: TelemetryPayload = {
      ...initialVehicle,
      lat: 18.7710,
      lng: 98.9765,
      timestamp: 15000,
    };

    rerender(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={updatedVehicle}
          isSelected={false}
          isOnline={true}
        />
      </MapContainer>
    );

    // requestAnimationFrame should be invoked to smoothly glide marker
    expect(rafSpy).toHaveBeenCalled();
  });

  it('snaps immediately without animating when jump distance exceeds threshold (teleport guard)', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    const { rerender } = render(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={initialVehicle}
          isSelected={false}
          isOnline={true}
          jumpThresholdKm={2.0}
        />
      </MapContainer>
    );

    rafSpy.mockClear();

    // Teleport from Chiang Mai (18.7695) to Bangkok (13.7563) ~580 km
    const teleportedVehicle: TelemetryPayload = {
      ...initialVehicle,
      lat: 13.7563,
      lng: 100.5018,
      timestamp: 15000,
    };

    rerender(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={teleportedVehicle}
          isSelected={false}
          isOnline={true}
          jumpThresholdKm={2.0}
        />
      </MapContainer>
    );

    // Should snap immediately without requestAnimationFrame
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('cancels animation frame on unmount', () => {
    const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount, rerender } = render(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={initialVehicle}
          isSelected={false}
          isOnline={true}
        />
      </MapContainer>
    );

    // Trigger animation
    rerender(
      <MapContainer center={[18.7695, 98.9759]} zoom={15}>
        <AnimatedVehicleMarker
          vehicle={{ ...initialVehicle, lat: 18.7715, timestamp: 15000 }}
          isSelected={false}
          isOnline={true}
        />
      </MapContainer>
    );

    unmount();
    expect(cancelRafSpy).toHaveBeenCalled();
  });
});
