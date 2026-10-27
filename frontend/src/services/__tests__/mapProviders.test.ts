import { describe, it, expect } from 'vitest';
import { getAllMapProviders, getMapProvider, MAP_PROVIDERS } from '../mapProviders';

describe('mapProviders service', () => {
  it('contains all 5 required map providers', () => {
    const providers = getAllMapProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('osm');
    expect(ids).toContain('openfreemap');
    expect(ids).toContain('maptiler');
    expect(ids).toContain('stadiamaps');
    expect(ids).toContain('longdomap');
    expect(MAP_PROVIDERS.osm).toBeDefined();
    expect(MAP_PROVIDERS.openfreemap).toBeDefined();
    expect(MAP_PROVIDERS.maptiler).toBeDefined();
    expect(MAP_PROVIDERS.stadiamaps).toBeDefined();
    expect(MAP_PROVIDERS.longdomap).toBeDefined();
  });

  it('correctly configures OpenStreetMap light tiles', () => {
    const osm = getMapProvider('osm');
    expect(osm.name).toBe('OpenStreetMap');
    expect(osm.tileUrl).toContain('tile.openstreetmap.org');
    expect(osm.keyRequired).toBe(false);
  });

  it('correctly configures OpenFreeMap light tiles', () => {
    const ofm = getMapProvider('openfreemap');
    expect(ofm.name).toBe('OpenFreeMap');
    expect(ofm.tileUrl).toContain('openfreemap.org');
    expect(ofm.keyRequired).toBe(false);
  });

  it('correctly configures MapTiler light tiles with provided API key', () => {
    const maptiler = getMapProvider('maptiler');
    expect(maptiler.name).toBe('MapTiler');
    expect(maptiler.tileUrl).toContain('api.maptiler.com');
    expect(maptiler.tileUrl).toContain('Xo9mrhG2PU9gLkZLFQ5i');
    expect(maptiler.keyRequired).toBe(true);
  });

  it('correctly configures Stadia Maps light tiles with provided API key', () => {
    const stadia = getMapProvider('stadiamaps');
    expect(stadia.name).toBe('Stadia Maps');
    expect(stadia.tileUrl).toContain('tiles.stadiamaps.com');
    expect(stadia.tileUrl).toContain('8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7');
    expect(stadia.keyRequired).toBe(true);
  });

  it('correctly configures Longdo Map light tiles with provided API key and EPSG:3857 projection', () => {
    const longdo = getMapProvider('longdomap');
    expect(longdo.name).toBe('Longdo Map');
    expect(longdo.tileUrl).toContain('ms.longdo.com');
    expect(longdo.tileUrl).toContain('72ba939d7a7166c36d59b88d0b125307');
    expect(longdo.tileUrl).toContain('proj=epsg3857');
    expect(longdo.keyRequired).toBe(true);
  });

  it('falls back to osm if an unknown provider id is requested', () => {
    const fallback = getMapProvider('unknown-provider');
    expect(fallback.id).toBe('osm');
  });
});
