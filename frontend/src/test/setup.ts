import '@testing-library/jest-dom';
import L from 'leaflet';

// Enable Leaflet SVG renderer support in JSDOM environment
(L.Browser as any).svg = true;

// Polyfill PointerEvent for JSDOM in tests
if (typeof window !== 'undefined' && !window.PointerEvent) {
  window.PointerEvent = window.MouseEvent as any;
}
