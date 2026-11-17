import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteCompareLab } from '../RouteCompareLab';

// Mock Leaflet and React-Leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="mock-osrm-map">{children}</div>,
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Polyline: (props: any) => <div data-testid={props['data-testid'] || 'mock-polyline'} />,
  Marker: (props: any) => <div data-testid={props['data-testid'] || 'mock-marker'} />,
  useMapEvents: () => null,
  useMap: () => ({
    panTo: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

describe('RouteCompareLab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders RouteCompareLab header, back button, and view mode options', () => {
    const handleBack = vi.fn();
    render(<RouteCompareLab onBack={handleBack} />);

    expect(screen.getByText(/Route Engine Comparison Lab/i)).toBeInTheDocument();
    expect(screen.getByText(/Longdo Map Native 100% vs OpenStreetMap \+ OSRM 100%/i)).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /กลับสู่แดชบอร์ด/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('switches between Split View, Hybrid, Pure Mapbox, Pure Longdo, and Pure OSRM view modes', () => {
    render(<RouteCompareLab />);

    const splitBtn = screen.getByRole('button', { name: /Split View/i });
    const hybridBtn = screen.getByRole('button', { name: /แบบผสม/i });
    const mapboxBtn = screen.getByRole('button', { name: /^Pure Mapbox 100%/i });
    const longdoBtn = screen.getByRole('button', { name: /Pure Longdo/i });
    const osrmBtn = screen.getByRole('button', { name: /Pure OSRM/i });

    expect(splitBtn).toBeInTheDocument();
    expect(hybridBtn).toBeInTheDocument();
    expect(mapboxBtn).toBeInTheDocument();
    expect(longdoBtn).toBeInTheDocument();
    expect(osrmBtn).toBeInTheDocument();

    // Default is Split View: Mapbox map container present
    expect(screen.getByTestId('mapbox-map-container')).toBeInTheDocument();
    expect(screen.queryByTestId('longdo-native-container')).toBeNull();

    // Switch to Pure Longdo
    fireEvent.click(longdoBtn);
    expect(screen.getByTestId('longdo-native-container')).toBeInTheDocument();
    expect(screen.queryByTestId('mapbox-map-container')).toBeNull();

    // Switch to Pure OSRM
    fireEvent.click(osrmBtn);
    expect(screen.queryByTestId('longdo-native-container')).toBeNull();
    expect(screen.queryByTestId('mapbox-map-container')).toBeNull();
    expect(screen.getByText(/100% Pure OpenStreetMap \+ OSRM/i)).toBeInTheDocument();

    // Switch to Pure Mapbox
    fireEvent.click(mapboxBtn);
    expect(screen.getByTestId('mapbox-map-container')).toBeInTheDocument();
    expect(screen.queryByTestId('longdo-native-container')).toBeNull();
  });

  it('allows pasting full coordinate string in quick paste inputs', () => {
    render(<RouteCompareLab />);

    const pickupPasteInput = screen.getByLabelText(/วางพิกัดจุดรับรวม/i);
    fireEvent.change(pickupPasteInput, {
      target: { value: '18.790094565006996, 98.96547138689851' },
    });

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i) as HTMLInputElement;
    const pickupLngInput = screen.getByLabelText(/ลองจิจูดจุดรับ/i) as HTMLInputElement;

    expect(Number(pickupLatInput.value)).toBeCloseTo(18.790094565, 5);
    expect(Number(pickupLngInput.value)).toBeCloseTo(98.965471386, 5);
  });

  it('allows selecting popular location presets', () => {
    render(<RouteCompareLab />);

    const presetBtn = screen.getByRole('button', { name: /รพ\.มหาราชฯ \(จุดรับ\)/i });
    fireEvent.click(presetBtn);

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i) as HTMLInputElement;
    expect(Number(pickupLatInput.value)).toBeCloseTo(18.7900, 3);
  });

  it('allows customizing Hybrid shuttle van routing options (traffic, alternatives, exclusions)', () => {
    render(<RouteCompareLab />);

    const trafficBtn = screen.getByRole('button', { name: /Hybrid โปรไฟล์การจราจรสด driving-traffic/i });
    const drivingBtn = screen.getByRole('button', { name: /Hybrid โปรไฟล์ปกติ driving/i });

    expect(trafficBtn).toBeInTheDocument();
    expect(drivingBtn).toBeInTheDocument();

    // Toggle driving profile
    fireEvent.click(drivingBtn);
    expect(screen.getAllByText(/Profile:/i)[0]).toHaveTextContent('driving');

    // Toggle exclusions checkboxes
    const tollCheckbox = screen.getByLabelText(/Hybrid เลี่ยงด่านค่าผ่านทาง/i) as HTMLInputElement;
    const motorwayCheckbox = screen.getByLabelText(/Hybrid เลี่ยงมอเตอร์เวย์/i) as HTMLInputElement;
    const altCheckbox = screen.getByLabelText(/Hybrid เปิดเส้นทางสำรอง/i) as HTMLInputElement;

    expect(tollCheckbox.checked).toBe(false);
    fireEvent.click(tollCheckbox);
    expect(tollCheckbox.checked).toBe(true);

    expect(motorwayCheckbox.checked).toBe(false);
    fireEvent.click(motorwayCheckbox);
    expect(motorwayCheckbox.checked).toBe(true);

    expect(altCheckbox.checked).toBe(true);
    fireEvent.click(altCheckbox);
    expect(altCheckbox.checked).toBe(false);

    // Toggle hide overlapping route segments
    const hideOverlapCheckbox = screen.getByLabelText(/Hybrid ซ่อนทางสำรองที่ทับกับทางหลัก/i) as HTMLInputElement;
    expect(hideOverlapCheckbox.checked).toBe(true);
    fireEvent.click(hideOverlapCheckbox);
    expect(hideOverlapCheckbox.checked).toBe(false);
  });

  it('allows customizing Pure Mapbox routing options (traffic, alternatives, exclusions)', () => {
    render(<RouteCompareLab />);

    const pmTrafficBtn = screen.getByRole('button', { name: /Pure Mapbox โปรไฟล์การจราจรสด driving-traffic/i });
    const pmDrivingBtn = screen.getByRole('button', { name: /Pure Mapbox โปรไฟล์ปกติ driving/i });

    expect(pmTrafficBtn).toBeInTheDocument();
    expect(pmDrivingBtn).toBeInTheDocument();

    // Toggle driving profile in Pure Mapbox
    fireEvent.click(pmDrivingBtn);
    expect(screen.getAllByText(/Profile:/i)[1]).toHaveTextContent('driving');

    // Toggle exclusions checkboxes in Pure Mapbox
    const pmTollCheckbox = screen.getByLabelText(/Pure Mapbox เลี่ยงด่านค่าผ่านทาง/i) as HTMLInputElement;
    const pmMotorwayCheckbox = screen.getByLabelText(/Pure Mapbox เลี่ยงมอเตอร์เวย์/i) as HTMLInputElement;
    const pmAltCheckbox = screen.getByLabelText(/Pure Mapbox เปิดเส้นทางสำรอง/i) as HTMLInputElement;
    const pmHideOverlapCheckbox = screen.getByLabelText(/Pure Mapbox ซ่อนทางสำรองที่ทับกับทางหลัก/i) as HTMLInputElement;

    expect(pmTollCheckbox.checked).toBe(false);
    fireEvent.click(pmTollCheckbox);
    expect(pmTollCheckbox.checked).toBe(true);

    expect(pmMotorwayCheckbox.checked).toBe(false);
    fireEvent.click(pmMotorwayCheckbox);
    expect(pmMotorwayCheckbox.checked).toBe(true);

    expect(pmAltCheckbox.checked).toBe(true);
    fireEvent.click(pmAltCheckbox);
    expect(pmAltCheckbox.checked).toBe(false);

    expect(pmHideOverlapCheckbox.checked).toBe(true);
    fireEvent.click(pmHideOverlapCheckbox);
    expect(pmHideOverlapCheckbox.checked).toBe(false);
  });
});
