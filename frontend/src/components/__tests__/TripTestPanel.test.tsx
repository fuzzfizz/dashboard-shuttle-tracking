import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TripTestPanel, parseCoordinateString } from '../TripTestPanel';

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

  it('allows manually typing pickup and dropoff coordinates and names', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    // Expand panel
    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i);
    const pickupLngInput = screen.getByLabelText(/ลองจิจูดจุดรับ/i);
    const pickupNameInput = screen.getByLabelText(/ชื่อจุดรับ/i);

    const dropoffLatInput = screen.getByLabelText(/ละติจูดจุดส่ง/i);
    const dropoffLngInput = screen.getByLabelText(/ลองจิจูดจุดส่ง/i);
    const dropoffNameInput = screen.getByLabelText(/ชื่อจุดส่ง/i);

    // Enter custom coordinates
    fireEvent.change(pickupNameInput, { target: { value: 'หน้าหอพักแพทย์' } });
    fireEvent.change(pickupLatInput, { target: { value: '18.78950' } });
    fireEvent.change(pickupLngInput, { target: { value: '98.98620' } });

    fireEvent.change(dropoffNameInput, { target: { value: 'อาคารเรียนรวม' } });
    fireEvent.change(dropoffLatInput, { target: { value: '18.79500' } });
    fireEvent.change(dropoffLngInput, { target: { value: '98.99200' } });

    const startBtn = screen.getByRole('button', { name: /คำนวณและเริ่มทริป/i });
    fireEvent.click(startBtn);

    expect(handleStartTrip).toHaveBeenCalledWith(
      'EV-01',
      { lat: 18.7895, lng: 98.9862, name: 'หน้าหอพักแพทย์' },
      { lat: 18.795, lng: 98.992, name: 'อาคารเรียนรวม' }
    );
  });

  it('allows selecting popular presets to populate pickup and dropoff coordinates', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    // Click a preset button for pickup
    const presetBtn = screen.getByRole('button', { name: /รพ\.มหาราชฯ \(จุดรับ\)/i });
    fireEvent.click(presetBtn);

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i) as HTMLInputElement;
    expect(Number(pickupLatInput.value)).toBeCloseTo(18.7900, 3);
  });

  it('shows validation error and disables submit when latitude or longitude is invalid', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i);
    fireEvent.change(pickupLatInput, { target: { value: 'invalid-coordinate' } });

    expect(screen.getByText(/กรุณากรอกพิกัดละติจูดและลองจิจูดที่ถูกต้อง/i)).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /คำนวณและเริ่มทริป/i });
    expect(startBtn).toBeDisabled();
    fireEvent.click(startBtn);

    expect(handleStartTrip).not.toHaveBeenCalled();
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

  describe('parseCoordinateString helper', () => {
    it('parses comma-separated coordinates with spaces', () => {
      const res = parseCoordinateString('18.790094565006996, 98.96547138689851');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(18.79009456, 6);
      expect(res?.lng).toBeCloseTo(98.96547138, 6);
    });

    it('parses comma-separated coordinates without spaces', () => {
      const res = parseCoordinateString('18.790094565006996,98.96547138689851');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(18.79009456, 6);
      expect(res?.lng).toBeCloseTo(98.96547138, 6);
    });

    it('parses space-separated coordinates', () => {
      const res = parseCoordinateString('18.790094565006996 98.96547138689851');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(18.79009456, 6);
      expect(res?.lng).toBeCloseTo(98.96547138, 6);
    });

    it('returns null for invalid strings', () => {
      expect(parseCoordinateString('invalid text')).toBeNull();
      expect(parseCoordinateString('18.7900')).toBeNull();
    });
  });

  it('automatically splits and populates lat and lng when full coordinate string is pasted into latitude input', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i) as HTMLInputElement;
    const pickupLngInput = screen.getByLabelText(/ลองจิจูดจุดรับ/i) as HTMLInputElement;

    // Paste full coordinate string into the latitude input
    fireEvent.change(pickupLatInput, {
      target: { value: '18.790094565006996, 98.96547138689851' },
    });

    expect(Number(pickupLatInput.value)).toBeCloseTo(18.790094565, 6);
    expect(Number(pickupLngInput.value)).toBeCloseTo(98.965471386, 6);
  });

  it('supports pasting into dedicated quick paste input for pickup and dropoff', () => {
    const handleStartTrip = vi.fn();
    render(<TripTestPanel {...defaultProps} onStartTrip={handleStartTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /ทดสอบเส้นทาง/i }));

    const pickupPasteInput = screen.getByLabelText(/วางพิกัดจุดรับรวม/i);
    fireEvent.change(pickupPasteInput, {
      target: { value: '18.790094565006996, 98.96547138689851' },
    });

    const pickupLatInput = screen.getByLabelText(/ละติจูดจุดรับ/i) as HTMLInputElement;
    const pickupLngInput = screen.getByLabelText(/ลองจิจูดจุดรับ/i) as HTMLInputElement;

    expect(Number(pickupLatInput.value)).toBeCloseTo(18.790094565, 6);
    expect(Number(pickupLngInput.value)).toBeCloseTo(98.965471386, 6);

    // Also test dropoff paste
    const dropoffPasteInput = screen.getByLabelText(/วางพิกัดจุดส่งรวม/i);
    fireEvent.change(dropoffPasteInput, {
      target: { value: '18.795000000000000, 98.992000000000000' },
    });

    const dropoffLatInput = screen.getByLabelText(/ละติจูดจุดส่ง/i) as HTMLInputElement;
    const dropoffLngInput = screen.getByLabelText(/ลองจิจูดจุดส่ง/i) as HTMLInputElement;

    expect(Number(dropoffLatInput.value)).toBeCloseTo(18.795, 6);
    expect(Number(dropoffLngInput.value)).toBeCloseTo(98.992, 6);
  });
});
