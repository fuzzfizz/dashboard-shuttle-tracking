import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../App';

describe('App Integration', () => {
  it('renders top brand header, Fleet Status, and map without crashing', () => {
    const { container } = render(<App />);
    expect(screen.getByText('Shuttle Tracker')).toBeInTheDocument();
    expect(screen.getByText('Multi-Vehicle Fleet Gateway')).toBeInTheDocument();
    expect(screen.getByText('Fleet Status')).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('opens and closes DailyMetricsModal when analytics button and close button are clicked', () => {
    render(<App />);

    expect(screen.queryByText('Daily Fleet Analytics')).not.toBeInTheDocument();

    const analyticsBtn = screen.getAllByRole('button', { name: /analytics/i })[0];
    fireEvent.click(analyticsBtn);
    expect(screen.getByText('Daily Fleet Analytics')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Daily Fleet Analytics')).not.toBeInTheDocument();
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

  it('does not exit fullscreen when Escape key is pressed while DailyMetricsModal is open', () => {
    render(<App />);

    // Expand to fullscreen
    const expandBtn = screen.getByRole('button', { name: /expand map to full screen/i });
    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Open Analytics modal from floating panel
    const analyticsBtn = screen.getByRole('button', { name: /analytics/i });
    fireEvent.click(analyticsBtn);
    expect(screen.getByText('Daily Fleet Analytics')).toBeInTheDocument();

    // First Escape closes modal, but preserves fullscreen
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Daily Fleet Analytics')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();

    // Second Escape exits fullscreen
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('button', { name: /exit full screen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand map to full screen/i })).toBeInTheDocument();
  });
});
