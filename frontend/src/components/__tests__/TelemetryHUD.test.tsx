import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TelemetryHUD } from '../TelemetryHUD';

describe('TelemetryHUD', () => {
  it('renders connecting state when no telemetry received yet', () => {
    render(<TelemetryHUD telemetry={null} status="connecting" lastSeen={null} />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for device telemetry/i)).toBeInTheDocument();
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
    expect(screen.getByText('SHUTTLE-01')).toBeInTheDocument();
    expect(screen.getByText('32.4')).toBeInTheDocument();
    expect(screen.getByText(/km\/h/i)).toBeInTheDocument();
    expect(screen.getByText(/13.7563, 100.5018/i)).toBeInTheDocument();
  });

  it('renders disconnected state appropriately', () => {
    render(<TelemetryHUD telemetry={null} status="disconnected" lastSeen={null} />);
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
    expect(screen.getByText('NO VEHICLE')).toBeInTheDocument();
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
});
