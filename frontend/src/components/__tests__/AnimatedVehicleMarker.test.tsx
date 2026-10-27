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

  it('calculates bearing automatically when vehicle moves East and telemetry heading is 0', () => {
    const initialVehicle: TelemetryPayload = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.7800,
      lng: 98.9800,
      speed: 25.0,
      heading: 0,
      timestamp: 1000,
    };

    const { rerender, container } = render(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={initialVehicle} />
      </MapContainer>
    );

    // Move vehicle directly East with speed 25 km/h, heading still 0 in telemetry
    const movedVehicle: TelemetryPayload = {
      ...initialVehicle,
      lng: 98.9850,
      timestamp: 6000,
    };

    rerender(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={movedVehicle} />
      </MapContainer>
    );

    const vanBody = container.querySelector('.shuttle-van-body');
    expect(vanBody).toBeDefined();
    // Bearing from 98.9800 to 98.9850 is ~90 deg East
    expect(vanBody?.getAttribute('style')).toMatch(/rotate\(9\ddeg\)/);
  });

  it('retains last known heading when vehicle stops (speed = 0)', () => {
    const movingVehicle: TelemetryPayload = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.7800,
      lng: 98.9800,
      speed: 30.0,
      heading: 120,
      timestamp: 1000,
    };

    const { rerender, container } = render(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={movingVehicle} />
      </MapContainer>
    );

    // Vehicle stops, speed = 0, no heading provided
    const stoppedVehicle: TelemetryPayload = {
      ...movingVehicle,
      speed: 0,
      heading: 0,
      timestamp: 6000,
    };

    rerender(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={stoppedVehicle} />
      </MapContainer>
    );

    const vanBody = container.querySelector('.shuttle-van-body');
    // Should retain 120 deg and NOT reset to 0 deg North
    expect(vanBody?.getAttribute('style')).toContain('rotate(120deg)');
  });

  it('uses shortest angle delta across 0/360 boundary to avoid full spin', () => {
    const headingNorthVehicle: TelemetryPayload = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.7800,
      lng: 98.9800,
      speed: 20.0,
      heading: 355,
      timestamp: 1000,
    };

    const { rerender, container } = render(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={headingNorthVehicle} />
      </MapContainer>
    );

    // Turn slightly right past North to 5 deg
    const turnedVehicle: TelemetryPayload = {
      ...headingNorthVehicle,
      heading: 5,
      timestamp: 6000,
    };

    rerender(
      <MapContainer center={[18.78, 98.98]} zoom={15}>
        <AnimatedVehicleMarker vehicle={turnedVehicle} />
      </MapContainer>
    );

    const vanBody = container.querySelector('.shuttle-van-body');
    // 355 + 10 = 365 deg (avoids spinning back -350 deg)
    expect(vanBody?.getAttribute('style')).toContain('rotate(365deg)');
  });
});
