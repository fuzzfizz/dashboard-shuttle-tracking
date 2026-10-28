import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplayMap, AutoFitBounds, createVehicleIcon } from '../ReplayMap';
import { HistoricalPoint } from '../../types/historical';

const mockFitBounds = vi.fn();
const mockSetView = vi.fn();

// Mock Leaflet react components to isolate DOM rendering
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="leaflet-map-container">{children}</div>,
  TileLayer: () => <div data-testid="leaflet-tile-layer" />,
  Polyline: ({ positions, pathOptions }: any) => (
    <div
      data-testid="leaflet-polyline"
      data-color={pathOptions?.color}
      data-count={positions?.length}
      data-dash={pathOptions?.dashArray}
    />
  ),
  Marker: ({ position, children }: any) => (
    <div data-testid="leaflet-marker" data-lat={position?.[0]} data-lng={position?.[1]}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: any) => <div data-testid="leaflet-tooltip">{children}</div>,
  useMap: () => ({ fitBounds: mockFitBounds, setView: mockSetView }),
}));

describe('ReplayMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const points: HistoricalPoint[] = [
    { vehicle_id: 'v1', lat: 13.73, lng: 100.52, speed: 20, heading: 90, recorded_at: '2026-10-28T08:00:00Z' },
    { vehicle_id: 'v1', lat: 13.74, lng: 100.53, speed: 25, heading: 95, recorded_at: '2026-10-28T08:00:10Z' },
  ];

  it('renders polylines and vehicle marker when points exist', () => {
    render(
      <ReplayMap
        points={points}
        traversedPoints={[points[0], points[1]]}
        currentPoint={points[0]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument();
    const polylines = screen.getAllByTestId('leaflet-polyline');
    expect(polylines.length).toBe(2);
    // Neutral route + active traversed route
    expect(polylines[0]).toHaveAttribute('data-color', '#94a3b8');
    expect(polylines[1]).toHaveAttribute('data-color', '#10b981');

    // Start pin, end pin, current point marker
    const markers = screen.getAllByTestId('leaflet-marker');
    expect(markers.length).toBe(3);
  });

  it('renders loading overlay when isLoading is true', () => {
    render(
      <ReplayMap
        points={[]}
        traversedPoints={[]}
        currentPoint={null}
        isLoading={true}
      />
    );

    expect(screen.getByText(/กำลังโหลดข้อมูลเส้นทาง/i)).toBeInTheDocument();
  });

  it('renders empty state banner when no points and not loading', () => {
    render(
      <ReplayMap
        points={[]}
        traversedPoints={[]}
        currentPoint={null}
        isLoading={false}
        emptyMessage="ไม่พบข้อมูลการเดินรถในวันที่เลือก"
      />
    );

    expect(screen.getByText(/ไม่พบข้อมูลการเดินรถในวันที่เลือก/i)).toBeInTheDocument();
    expect(screen.getByText(/กรุณาเลือกวันที่หรือรถคันอื่นจากแถบเครื่องมือด้านบน/i)).toBeInTheDocument();
  });

  it('renders default empty message when emptyMessage prop is omitted', () => {
    render(
      <ReplayMap
        points={[]}
        traversedPoints={[]}
        currentPoint={null}
        isLoading={false}
      />
    );

    expect(screen.getByText(/ไม่พบประวัติการเดินรถในวันที่เลือก/i)).toBeInTheDocument();
  });

  it('fits bounds when points length >= 2', () => {
    render(<AutoFitBounds points={points} />);
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
  });

  it('sets view when points length is 1', () => {
    render(<AutoFitBounds points={[points[0]]} />);
    expect(mockSetView).toHaveBeenCalledWith([13.73, 100.52], 16);
  });

  it('generates vehicle icon with heading rotation', () => {
    const icon = createVehicleIcon(180);
    expect(icon.options.html).toContain('transform: rotate(180deg)');
  });
});
