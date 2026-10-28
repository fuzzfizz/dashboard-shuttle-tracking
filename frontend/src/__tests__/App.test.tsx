import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../App';
import * as shuttleHook from '../hooks/useShuttleTelemetry';
import * as dailyMetricsHook from '../hooks/useDailyMetrics';

describe('App Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
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

  it('renders top brand header, clean full-width map, and daily distance table without Fleet Status clutter', () => {
    const { container } = render(<App />);
    expect(screen.getByText('Shuttle Tracker')).toBeInTheDocument();
    expect(screen.getByText('Multi-Vehicle Fleet Gateway')).toBeInTheDocument();
    expect(screen.getByText('Fleet Live Map')).toBeInTheDocument();
    // Confirms Fleet Status panel has been removed from main dashboard
    expect(screen.queryByText('Fleet Status')).toBeNull();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('renders #fleet-analytics as a full-width bottom section containing DailyDistanceTable', () => {
    const { container } = render(<App />);
    const analyticsSection = container.querySelector('#fleet-analytics');
    expect(analyticsSection).toBeInTheDocument();
    expect(analyticsSection).toHaveClass('w-full');
    expect(screen.getByText('Daily Distance Overview')).toBeInTheDocument();
  });

  it('triggers scrollIntoView on #fleet-analytics when header Analytics button is clicked', () => {
    const { container } = render(<App />);
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView');

    const analyticsButton = screen.getByRole('button', { name: 'View Daily Analytics' });
    fireEvent.click(analyticsButton);

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

  it('keeps fullscreen overview 100% clean without bottom HUD or Fleet Status when no vehicle is selected', () => {
    vi.spyOn(shuttleHook, 'useShuttleTelemetry').mockReturnValue({
      status: 'connected',
      vehicles: {},
      lastSeenMap: {},
      selectedVehicleId: null,
      setSelectedVehicleId: vi.fn(),
      telemetry: null as any,
      lastSeen: null,
      now: Date.now(),
    });

    render(<App />);

    // Enter fullscreen
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);

    // Verify exit button exists
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Verify Fleet Status and bottom Telemetry HUD are completely absent for clean overview
    expect(screen.queryByText('Fleet Status')).toBeNull();
    expect(screen.queryByText(/Broker:/i)).toBeNull();
  });

  it('displays consumer-friendly vehicle card without broker jargon when a vehicle is focused in fullscreen', () => {
    const testVehicle = {
      vehicle_id: 'shuttle-cm-01',
      lat: 18.79,
      lng: 98.98,
      speed: 35.5,
      heading: 180,
      timestamp: Date.now(),
    };

    vi.spyOn(shuttleHook, 'useShuttleTelemetry').mockReturnValue({
      status: 'connected',
      vehicles: { 'shuttle-cm-01': testVehicle },
      lastSeenMap: { 'shuttle-cm-01': Date.now() },
      selectedVehicleId: 'shuttle-cm-01',
      setSelectedVehicleId: vi.fn(),
      telemetry: testVehicle,
      lastSeen: Date.now(),
      now: Date.now(),
    });

    vi.spyOn(dailyMetricsHook, 'useDailyMetrics').mockReturnValue({
      dailyMetrics: {
        'shuttle-cm-01': {
          vehicle_id: 'shuttle-cm-01',
          date: '2026-10-28',
          total_distance_km: 18.25,
          max_speed_kmh: 42,
          avg_speed_kmh: 25,
          active_minutes: 60,
          last_updated_at: new Date().toISOString(),
        },
      },
      totalFleetDistanceKm: 18.25,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<App />);

    // Enter fullscreen
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);

    // Shows vehicle ID, speed, today distance, moving status
    expect(screen.getAllByText('shuttle-cm-01').length).toBeGreaterThan(0);
    expect(screen.getByText('35.5')).toBeInTheDocument();
    expect(screen.getByText(/18.25/)).toBeInTheDocument();
    expect(screen.getByText(/Moving \/ กำลังวิ่ง/i)).toBeInTheDocument();

    // Confirms no broker technical jargon is shown
    expect(screen.queryByText(/Broker:/i)).toBeNull();
    expect(screen.queryByText('Fleet Status')).toBeNull();
  });

  it('renders theme toggle button in header and defaults to light mode', () => {
    render(<App />);
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('switches theme to dark mode when header toggle is clicked', () => {
    render(<App />);
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
    fireEvent.click(toggleBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(localStorage.getItem('shuttle_theme')).toBe('dark');

    // Click again to return to light mode
    const lightBtn = screen.getByRole('button', { name: /switch to light mode/i });
    fireEvent.click(lightBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    expect(localStorage.getItem('shuttle_theme')).toBe('light');
  });
});
