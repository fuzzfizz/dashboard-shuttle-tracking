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

  it('switches between Split View, Pure Longdo, and Pure OSRM view modes', () => {
    render(<RouteCompareLab />);

    const splitBtn = screen.getByRole('button', { name: /Split View/i });
    const longdoBtn = screen.getByRole('button', { name: /Pure Longdo/i });
    const osrmBtn = screen.getByRole('button', { name: /Pure OSRM/i });

    expect(splitBtn).toBeInTheDocument();
    expect(longdoBtn).toBeInTheDocument();
    expect(osrmBtn).toBeInTheDocument();

    // Default is Split View: both maps present
    expect(screen.getByTestId('longdo-native-container')).toBeInTheDocument();
    expect(screen.getByTestId('mock-osrm-map')).toBeInTheDocument();

    // Switch to Pure Longdo
    fireEvent.click(longdoBtn);
    expect(screen.getByTestId('longdo-native-container')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-osrm-map')).toBeNull();

    // Switch to Pure OSRM
    fireEvent.click(osrmBtn);
    expect(screen.queryByTestId('longdo-native-container')).toBeNull();
    expect(screen.getByTestId('mock-osrm-map')).toBeInTheDocument();
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
});
