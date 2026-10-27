import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../App';
import * as shuttleHook from '../hooks/useShuttleTelemetry';
import * as dailyMetricsHook from '../hooks/useDailyMetrics';

describe('App Integration', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('renders MapProviderTestLab when URL is /map-test', async () => {
    window.history.pushState({}, '', '/map-test');
    const { findByText } = render(<App />);
    expect(await findByText(/Map Provider Lab/i)).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('renders default operational dashboard at / without any public map-test button', () => {
    window.history.pushState({}, '', '/');
    const { queryByText, getByText } = render(<App />);
    expect(getByText('Shuttle Tracker')).toBeInTheDocument();
    // No public button pointing to map-test on main dashboard
    expect(queryByText(/Map Provider Lab/i)).toBeNull();
  });

  it('renders MapProviderTestLab when URL hash is #map-test', async () => {
    window.history.pushState({}, '', '/#map-test');
    const { findByText } = render(<App />);
    expect(await findByText(/Map Provider Lab/i)).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('navigates back to dashboard when Back button is clicked in MapProviderTestLab', async () => {
    window.history.pushState({}, '', '/map-test');
    const { findByText, getByText, queryByText } = render(<App />);
    const backBtn = await findByText(/Back/i);
    fireEvent.click(backBtn);
    expect(getByText('Shuttle Tracker')).toBeInTheDocument();
    expect(queryByText(/Map Provider Lab/i)).toBeNull();
  });

  it('renders top brand header, Fleet Status, and map without crashing', () => {
    const { container } = render(<App />);
    expect(screen.getByText('Shuttle Tracker')).toBeInTheDocument();
    expect(screen.getByText('Multi-Vehicle Fleet Gateway')).toBeInTheDocument();
    expect(screen.getByText('Fleet Status')).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('renders #fleet-analytics as a full-width bottom section containing DailyDistanceTable', () => {
    const { container } = render(<App />);
    const analyticsSection = container.querySelector('#fleet-analytics');
    expect(analyticsSection).toBeInTheDocument();
    expect(analyticsSection).toHaveClass('lg:col-span-12');
    expect(screen.getByText('Daily Distance Overview')).toBeInTheDocument();
  });

  it('triggers scrollIntoView on #fleet-analytics when header Analytics button is clicked', () => {
    const { container } = render(<App />);
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView');

    const analyticsButtons = screen.getAllByRole('button', { name: 'View Daily Analytics' });
    fireEvent.click(analyticsButtons[0]);

    const analyticsSection = container.querySelector('#fleet-analytics');
    expect(analyticsSection).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('triggers scrollIntoView on #fleet-analytics when FleetPanel Analytics button is clicked', () => {
    const { container } = render(<App />);
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView');

    const analyticsButtons = screen.getAllByRole('button', { name: 'View Daily Analytics' });
    // Click panel analytics button (second one in the DOM)
    fireEvent.click(analyticsButtons[1]);

    const analyticsSection = container.querySelector('#fleet-analytics');
    expect(analyticsSection).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('renders compact map card with expand button and toggles fullscreen on click', () => {
    render(<App />);

    // Default compact mode: Expand button is visible
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    expect(expandBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();

    // Click expand button to enter fullscreen
    fireEvent.click(expandBtn);

    // Fullscreen mode: Exit button is visible
    const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
    expect(exitBtn).toBeInTheDocument();

    // Click exit button to return to compact mode
    fireEvent.click(exitBtn);
    expect(screen.getByRole('button', { name: /expand map to full screen/i })).toBeInTheDocument();
  });

  it('exits fullscreen mode when Escape key is pressed', () => {
    render(<App />);

    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Should return to compact mode
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand map to full screen/i })).toBeInTheDocument();
  });

  it('preserves the same map container DOM node across fullscreen toggle', () => {
    const { container } = render(<App />);
    const mapEl = container.querySelector('.leaflet-container');
    expect(mapEl).not.toBeNull();

    // Toggle to fullscreen
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);

    // Check map container DOM instance is preserved without remount
    const mapElAfter = container.querySelector('.leaflet-container');
    expect(mapElAfter).toBe(mapEl);

    // Toggle back to compact
    const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
    fireEvent.click(exitBtn);

    const mapElFinal = container.querySelector('.leaflet-container');
    expect(mapElFinal).toBe(mapEl);
  });

  it('opens map in fullscreen mode when a vehicle row is clicked in DailyDistanceTable', () => {
    const testVehicle = {
      vehicle_id: 'EV-01',
      lat: 13.75,
      lng: 100.5,
      speed: 30,
      timestamp: Date.now(),
    };

    const setSelectedVehicleIdMock = vi.fn();

    vi.spyOn(shuttleHook, 'useShuttleTelemetry').mockReturnValue({
      status: 'connected',
      vehicles: {
        'EV-01': testVehicle,
      },
      lastSeenMap: { 'EV-01': Date.now() },
      selectedVehicleId: null,
      setSelectedVehicleId: setSelectedVehicleIdMock,
      telemetry: testVehicle,
      lastSeen: Date.now(),
      now: Date.now(),
    });

    vi.spyOn(dailyMetricsHook, 'useDailyMetrics').mockReturnValue({
      dailyMetrics: {
        'EV-01': {
          vehicle_id: 'EV-01',
          date: '2026-10-26',
          total_distance_km: 15.4,
          max_speed_kmh: 40,
          avg_speed_kmh: 20,
          active_minutes: 45,
          last_updated_at: new Date().toISOString(),
        },
      },
      totalFleetDistanceKm: 15.4,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<App />);

    // DailyDistanceTable displays EV-01 and 15.40 km
    expect(screen.getAllByText('EV-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15.40 km').length).toBeGreaterThan(0);

    // Initially in compact mode
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();

    // Click "Open map for EV-01" button in the table row
    const openBtn = screen.getByRole('button', { name: /open map for ev-01/i });
    fireEvent.click(openBtn);

    // Map transitions to fullscreen and selects EV-01
    expect(setSelectedVehicleIdMock).toHaveBeenCalledWith('EV-01');
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();
  });
});
