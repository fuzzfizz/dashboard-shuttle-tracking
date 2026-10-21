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

    const analyticsBtn = screen.getByRole('button', { name: /analytics/i });
    fireEvent.click(analyticsBtn);
    expect(screen.getByText('Daily Fleet Analytics')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Daily Fleet Analytics')).not.toBeInTheDocument();
  });
});
