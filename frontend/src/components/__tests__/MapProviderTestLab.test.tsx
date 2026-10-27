import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapProviderTestLab } from '../MapProviderTestLab';

describe('MapProviderTestLab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders test lab header with Light mode as default UI theme', () => {
    const { container } = render(<MapProviderTestLab />);
    expect(screen.getByText(/Map Provider Lab/i)).toBeInTheDocument();

    // Light mode is default
    const themeToggle = screen.getByRole('button', { name: /Light/i });
    expect(themeToggle).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-100, .bg-gray-50, .bg-slate-50')).not.toBeNull();
  });

  it('toggles UI theme between Light and Dark mode', () => {
    const { container } = render(<MapProviderTestLab />);
    const darkButton = screen.getByRole('button', { name: /Dark/i });
    fireEvent.click(darkButton);

    // Dark mode container styles active
    expect(container.querySelector('.bg-slate-950')).not.toBeNull();

    // Toggle back to Light mode
    const lightButton = screen.getByRole('button', { name: /Light/i });
    fireEvent.click(lightButton);
    expect(container.querySelector('.bg-slate-100, .bg-gray-50, .bg-slate-50')).not.toBeNull();
  });

  it('renders provider selection pills for all 5 providers', () => {
    render(<MapProviderTestLab />);
    expect(screen.getByRole('button', { name: /OpenStreetMap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenFreeMap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MapTiler/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stadia Maps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Longdo Map/i })).toBeInTheDocument();
  });

  it('switches between Single View and Grid Compare modes', () => {
    render(<MapProviderTestLab />);
    const gridButton = screen.getByRole('button', { name: /Grid Compare/i });
    fireEvent.click(gridButton);

    expect(screen.getByText(/Comparing 5 Providers/i)).toBeInTheDocument();

    const singleButton = screen.getByRole('button', { name: /Single View/i });
    fireEvent.click(singleButton);
    expect(screen.queryByText(/Comparing 5 Providers/i)).toBeNull();
  });

  it('toggles shuttle van marker preview on and off', () => {
    render(<MapProviderTestLab />);
    const shuttleToggle = screen.getByRole('button', { name: /Shuttle Icon/i });
    expect(shuttleToggle).toBeInTheDocument();
    fireEvent.click(shuttleToggle);
    expect(screen.getByRole('button', { name: /Shuttle Icon: OFF/i })).toBeInTheDocument();

    // Toggle back ON
    fireEvent.click(screen.getByRole('button', { name: /Shuttle Icon: OFF/i }));
    expect(screen.getByRole('button', { name: /Shuttle Icon: ON/i })).toBeInTheDocument();
  });

  it('switches active provider in Single View and displays provider metadata', () => {
    render(<MapProviderTestLab />);

    // Default provider is OpenStreetMap
    expect(screen.getByText(/Standard community-driven global road map/i)).toBeInTheDocument();

    // Switch to MapTiler
    fireEvent.click(screen.getByRole('button', { name: /MapTiler/i }));
    expect(screen.getByText(/High-detail professional cartography/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Commercial \/ High-Res/i)[0]).toBeInTheDocument();

    // Switch to Longdo Map
    fireEvent.click(screen.getByRole('button', { name: /Longdo Map/i }));
    expect(screen.getByText(/Premier Thai localized map/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Thai Localized/i)[0]).toBeInTheDocument();
  });

  it('renders back button or home navigation callback if provided', () => {
    const onBack = vi.fn();
    render(<MapProviderTestLab onBack={onBack} />);
    const backBtn = screen.getByRole('button', { name: /Back/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
