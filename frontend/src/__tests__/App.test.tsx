import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../App';

describe('App Integration', () => {
  it('renders top brand header and HUD without crashing', () => {
    render(<App />);
    expect(screen.getByText('Shuttle Tracker')).toBeInTheDocument();
    expect(screen.getByText('Live Hardware Gateway')).toBeInTheDocument();
    expect(screen.getByText(/Telemetry Feed/i)).toBeInTheDocument();
  });
});
