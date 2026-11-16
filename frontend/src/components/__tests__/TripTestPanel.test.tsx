import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TripTestPanel } from '../TripTestPanel';

describe('TripTestPanel', () => {
  const defaultProps = {
    vehicleIds: ['EV-01', 'EV-02'],
    selectedVehicleId: 'EV-01',
    onSelectVehicle: vi.fn(),
    pinMode: 'idle' as const,
    onSetPinMode: vi.fn(),
    onStartTrip: vi.fn(),
    onClearTrip: vi.fn(),
    isCalculating: false,
    error: null,
  };

  it('renders collapsed toggle button by default and expands on click', () => {
    render(<TripTestPanel {...defaultProps} />);

    const toggleBtn = screen.getByRole('button', { name: /ทดสอบเส้นทาง/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText('กำหนดจุดรับ-ส่ง สำหรับทดสอบ')).toBeNull();

    // Click expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText('กำหนดจุดรับ-ส่ง สำหรับทดสอบ')).toBeInTheDocument();
  });

  it('triggers pin mode callbacks for pickup and dropoff buttons', () => {
    const handleSetPinMode = vi.fn();
    render(<TripTestPanel {...defaultProps} onSetPinMode={handleSetPinMode} />);

    // Expand panel
    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickPickupBtn = screen.getByRole('button', { name: /จิ้มจุดรับบนแผนที่/i });
    fireEvent.click(pickPickupBtn);
    expect(handleSetPinMode).toHaveBeenCalledWith('pick-pickup');

    const pickDropoffBtn = screen.getByRole('button', { name: /จิ้มจุดส่งบนแผนที่/i });
    fireEvent.click(pickDropoffBtn);
    expect(handleSetPinMode).toHaveBeenCalledWith('pick-dropoff');
  });

  it('calls onStartTrip when valid coordinates are entered and Start button is clicked', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const startBtn = screen.getByRole('button', { name: /คำนวณและเริ่มทริป/i });
    fireEvent.click(startBtn);

    expect(handleStartTrip).toHaveBeenCalledWith(
      'EV-01',
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) })
    );
  });

  it('disables start trip button when isCalculating is true', () => {
    render(<TripTestPanel {...defaultProps} isCalculating={true} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const startBtn = screen.getByRole('button', { name: /กำลังคำนวณ/i });
    expect(startBtn).toBeDisabled();
  });

  it('renders error message when error prop is provided', () => {
    render(<TripTestPanel {...defaultProps} error="ไม่สามารถคำนวณเส้นทางได้" />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    expect(screen.getByText('ไม่สามารถคำนวณเส้นทางได้')).toBeInTheDocument();
  });

  it('displays trip details and allows clearing when activeTrip is provided', () => {
    const handleClearTrip = vi.fn();
    const mockTrip = {
      vehicleId: 'EV-01',
      pickup: { lat: 18.7883, lng: 98.9853, name: 'Start' },
      dropoff: { lat: 18.7900, lng: 98.9900, name: 'End' },
      plannedPath: [[18.7883, 98.9853], [18.7900, 98.9900]] as Array<[number, number]>,
      distanceMeters: 2500,
      createdAt: Date.now(),
    };

    render(<TripTestPanel {...defaultProps} activeTrip={mockTrip} onClearTrip={handleClearTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    expect(screen.getByText(/ระยะทางใบจอง: 2.50 km/)).toBeInTheDocument();
    expect(screen.getByText(/จุดพิกัดถนน: 2 จุด/)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /ล้างเส้นทาง/i });
    fireEvent.click(clearBtn);

    expect(handleClearTrip).toHaveBeenCalledWith('EV-01');
  });

  it('updates targetVehicleId and calls onSelectVehicle on change', () => {
    const handleSelectVehicle = vi.fn();
    render(<TripTestPanel {...defaultProps} onSelectVehicle={handleSelectVehicle} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'EV-02' } });

    expect(handleSelectVehicle).toHaveBeenCalledWith('EV-02');
  });

  it('updates pickup coordinate and resets pinMode when pendingPoint is received in pick-pickup mode', () => {
    const handleSetPinMode = vi.fn();
    const { rerender } = render(
      <TripTestPanel
        {...defaultProps}
        pinMode="pick-pickup"
        onSetPinMode={handleSetPinMode}
      />
    );

    rerender(
      <TripTestPanel
        {...defaultProps}
        pinMode="pick-pickup"
        pendingPoint={{ lat: 18.78912, lng: 98.98123 }}
        onSetPinMode={handleSetPinMode}
      />
    );

    expect(handleSetPinMode).toHaveBeenCalledWith('idle');
  });
});
