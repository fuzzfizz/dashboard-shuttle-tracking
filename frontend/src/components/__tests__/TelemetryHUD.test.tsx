import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TelemetryHUD } from '../TelemetryHUD';

describe('TelemetryHUD', () => {
  it('renders connecting state when no telemetry received yet', () => {
    render(<TelemetryHUD telemetry={null} status="connecting" lastSeen={null} />);
    expect(screen.getByText(/Broker: connecting/i)).toBeInTheDocument();
    expect(screen.getByText('Overview (0 online)')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('renders vehicle speed and ID when telemetry is provided', () => {
    const telemetry = {
      vehicle_id: 'shuttle-01',
      lat: 13.7563,
      lng: 100.5018,
      speed: 32.4,
      heading: 90,
      timestamp: Date.now(),
    };
    render(<TelemetryHUD telemetry={telemetry} status="connected" lastSeen={Date.now()} />);
    expect(screen.getByText('shuttle-01')).toBeInTheDocument();
    expect(screen.getByText('32.4')).toBeInTheDocument();
    expect(screen.getByText(/km\/h/i)).toBeInTheDocument();
    expect(screen.getByText('90°')).toBeInTheDocument();
    expect(screen.queryByText('Signal Lost')).toBeNull();
  });

  it('renders disconnected state appropriately', () => {
    render(<TelemetryHUD telemetry={null} status="disconnected" lastSeen={null} />);
    expect(screen.getByText(/Broker: disconnected/i)).toBeInTheDocument();
    expect(screen.getByText('Overview (0 online)')).toBeInTheDocument();
  });

  it('renders last packet relative time correctly', () => {
    const pastTime = Date.now() - 5000;
    const telemetry = {
      vehicle_id: 'shuttle-02',
      lat: 13.7563,
      lng: 100.5018,
      speed: 0,
      heading: 180,
      timestamp: pastTime,
    };
    render(<TelemetryHUD telemetry={telemetry} status="connected" lastSeen={pastTime} />);
    expect(screen.getByText(/5s ago/i)).toBeInTheDocument();
  });

  it('renders fleet overview mode with total vehicles', () => {
    render(
      <TelemetryHUD
        telemetry={null}
        status="connected"
        lastSeen={Date.now()}
        totalVehicles={2}
      />
    );
    expect(screen.getByText('Overview (2 online)')).toBeInTheDocument();
    expect(screen.getByText(/Broker: connected/i)).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
  });

  it('renders overview mode with calculated fleetStats and latest heartbeat', () => {
    const fleetStats = {
      totalVehicles: 3,
      onlineVehicles: 2,
      averageSpeed: 24.6,
    };
    const latestHeartbeat = Date.now() - 2000; // 2s ago

    render(
      <TelemetryHUD
        telemetry={null}
        status="connected"
        lastSeen={latestHeartbeat}
        fleetStats={fleetStats}
      />
    );

    expect(screen.getByText('Overview (2 online)')).toBeInTheDocument();
    expect(screen.getByText('24.6')).toBeInTheDocument();
    expect(screen.getByText('2s ago')).toBeInTheDocument();
    expect(screen.queryByText('Signal Lost')).toBeNull();
  });

  it('renders Signal Lost badge when focused vehicle is offline', () => {
    const telemetry = {
      vehicle_id: 'shuttle-09',
      lat: 13.7563,
      lng: 100.5018,
      speed: 0,
      heading: 0,
      timestamp: Date.now() - 25000,
    };

    render(
      <TelemetryHUD
        telemetry={telemetry}
        status="connected"
        lastSeen={Date.now() - 25000}
        isOnline={false}
      />
    );

    expect(screen.getByText('shuttle-09')).toBeInTheDocument();
    expect(screen.getByText('Signal Lost')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <TelemetryHUD
        telemetry={null}
        status="connected"
        lastSeen={null}
        className="custom-hud-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-hud-class');
  });
});