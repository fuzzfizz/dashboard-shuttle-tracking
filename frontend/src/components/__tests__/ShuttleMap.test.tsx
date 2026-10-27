import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import L from 'leaflet';
import { ShuttleMap, escapeHtml, createVehicleIcon } from '../ShuttleMap';
import { FleetMap } from '../../types/telemetry';

describe('ShuttleMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('safely escapes special characters in escapeHtml to prevent DOM XSS', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeHtml('shuttle-01')).toBe('shuttle-01');
  });

  it('properly escapes vehicle ID badge to protect against DOM XSS', () => {
    const xssPayload = '<img src=x onerror=alert(1)>';
    const icon = createVehicleIcon(0, false, xssPayload, true);
    expect(icon.options.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(icon.options.html).not.toContain('<img src=x onerror=alert(1)>');

    const vehicles: FleetMap = {
      [xssPayload]: {
        vehicle_id: xssPayload,
        lat: 13.7563,
        lng: 100.5018,
        speed: 20,
        heading: 0,
        timestamp: Date.now(),
      },
    };
    const { container } = render(<ShuttleMap vehicles={vehicles} />);
    expect(container.innerHTML).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('creates shuttle van icon with headlight beam, van body, and non-rotating vehicle id badge', () => {
    const icon = createVehicleIcon(90, true, 'VAN-01', true);
    expect(icon.options.className).toBe('custom-vehicle-marker');
    expect(icon.options.iconSize).toEqual([52, 52]);
    expect(icon.options.iconAnchor).toEqual([26, 26]);

    const html = icon.options.html as string;
    expect(html).toContain('VAN-01');
    expect(html).toContain('rotate(90deg)');
    // Headlight beam / van indicators
    expect(html).toContain('headlight-beam');
    expect(html).toContain('shuttle-van-body');
  });

  it('dims marker styling and disables pulse animation when vehicle is offline', () => {
    const onlineIcon = createVehicleIcon(90, false, 'EV-01', true);
    expect(onlineIcon.options.html).toContain('animation: pulse');
    expect(onlineIcon.options.html).toContain('opacity: 1');
    expect(onlineIcon.options.html).toContain('headlight-beam');

    const offlineIcon = createVehicleIcon(90, false, 'EV-01', false);
    expect(offlineIcon.options.html).not.toContain('animation: pulse');
    expect(offlineIcon.options.html).toContain('opacity: 0.6');
    expect(offlineIcon.options.html).not.toContain('headlight-beam');

    // Selected vehicle offline
    const selectedOfflineIcon = createVehicleIcon(90, true, 'EV-01', false);
    expect(selectedOfflineIcon.options.html).not.toContain('animation: pulse');
    expect(selectedOfflineIcon.options.html).toContain('opacity: 0.6');
  });

  it('stabilizes camera in overview mode and prevents fitBounds thrashing', () => {
    const fitBoundsSpy = vi.spyOn(L.Map.prototype, 'fitBounds').mockImplementation(() => ({} as any));
    const panToSpy = vi.spyOn(L.Map.prototype, 'panTo').mockImplementation(() => ({} as any));

    const fleetA: FleetMap = {
      'EV-01': { vehicle_id: 'EV-01', lat: 13.75, lng: 100.5, speed: 20, timestamp: 1000 },
      'EV-02': { vehicle_id: 'EV-02', lat: 13.76, lng: 100.51, speed: 25, timestamp: 1000 },
    };

    // 1. Initial mount with 2 vehicles triggers fitBounds once
    const { rerender } = render(<ShuttleMap vehicles={fleetA} selectedVehicleId={null} />);
    expect(fitBoundsSpy).toHaveBeenCalledTimes(1);

    // 2. Continuous telemetry packet with unchanged vehicle count in overview mode:
    // Should NOT trigger fitBounds again
    const fleetAUpdated: FleetMap = {
      'EV-01': { vehicle_id: 'EV-01', lat: 13.7505, lng: 100.5005, speed: 22, timestamp: 2000 },
      'EV-02': { vehicle_id: 'EV-02', lat: 13.7605, lng: 100.5105, speed: 27, timestamp: 2000 },
    };
    rerender(<ShuttleMap vehicles={fleetAUpdated} selectedVehicleId={null} />);
    expect(fitBoundsSpy).toHaveBeenCalledTimes(1);

    // 3. User switches to Focus Mode on EV-01: triggers panTo with initial focus duration 1.0
    rerender(<ShuttleMap vehicles={fleetAUpdated} selectedVehicleId="EV-01" />);
    expect(panToSpy).toHaveBeenCalledWith([13.7505, 100.5005], { animate: true, duration: 1.0 });

    // 4. Focus Mode same coordinates: panTo not called again
    const panToCount = panToSpy.mock.calls.length;
    rerender(<ShuttleMap vehicles={fleetAUpdated} selectedVehicleId="EV-01" />);
    expect(panToSpy).toHaveBeenCalledTimes(panToCount);

    // 4.5. Subsequent telemetry update for focused EV-01 with 5s timeDelta:
    // Synchronizes camera pan duration with vehicle movement (5.0s, easeLinearity: 0.1)
    const fleetAProgressed: FleetMap = {
      ...fleetAUpdated,
      'EV-01': { vehicle_id: 'EV-01', lat: 13.7510, lng: 100.5010, speed: 25, timestamp: 7000 },
    };
    rerender(<ShuttleMap vehicles={fleetAProgressed} selectedVehicleId="EV-01" />);
    expect(panToSpy).toHaveBeenLastCalledWith([13.7510, 100.5010], {
      animate: true,
      duration: 5.0,
      easeLinearity: 0.1,
    });

    // 5. User switches from Focus Mode back to Overview Mode: triggers fitBounds
    rerender(<ShuttleMap vehicles={fleetAUpdated} selectedVehicleId={null} />);
    expect(fitBoundsSpy).toHaveBeenCalledTimes(2);

    // 6. Fleet size changes (vehicle added): triggers fitBounds
    const fleetB: FleetMap = {
      ...fleetAUpdated,
      'EV-03': { vehicle_id: 'EV-03', lat: 13.77, lng: 100.52, speed: 18, timestamp: 2000 },
    };
    rerender(<ShuttleMap vehicles={fleetB} selectedVehicleId={null} />);
    expect(fitBoundsSpy).toHaveBeenCalledTimes(3);

    fitBoundsSpy.mockRestore();
    panToSpy.mockRestore();
  });

  it('calls map.invalidateSize when isFullscreen prop changes or window resizes', async () => {
    const invalidateSizeSpy = vi.spyOn(L.Map.prototype, 'invalidateSize').mockImplementation(() => ({} as any));

    const { rerender } = render(<ShuttleMap vehicles={{}} isFullscreen={false} />);

    // Toggle fullscreen prop
    rerender(<ShuttleMap vehicles={{}} isFullscreen={true} />);

    // Wait for the scheduled timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(invalidateSizeSpy).toHaveBeenCalled();

    // Trigger window resize event
    window.dispatchEvent(new Event('resize'));
    expect(invalidateSizeSpy).toHaveBeenCalledTimes(2);

    invalidateSizeSpy.mockRestore();
  });

  it('displays a friendly notice when selected vehicle has no GPS location data', () => {
    const { getByText } = render(
      <ShuttleMap vehicles={{}} selectedVehicleId="UNKNOWN-01" />
    );
    expect(getByText(/No GPS coordinates recorded for UNKNOWN-01/i)).toBeInTheDocument();
  });
});
