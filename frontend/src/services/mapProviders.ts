export interface MapProviderConfig {
  id: string;
  name: string;
  category: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  description: string;
  keyRequired: boolean;
  isVector?: boolean;
}

export const DEFAULT_MAPTILER_KEY =
  import.meta.env.VITE_MAPTILER_KEY || 'Xo9mrhG2PU9gLkZLFQ5i';
export const DEFAULT_STADIA_KEY =
  import.meta.env.VITE_STADIA_KEY || '8c4b809b-28d1-4ff7-98eb-5ea527c6c5e7';
export const DEFAULT_LONGDO_KEY =
  import.meta.env.VITE_LONGDO_KEY || '72ba939d7a7166c36d59b88d0b125307';

export const MAP_PROVIDERS: Record<string, MapProviderConfig> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    category: 'Open Source',
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    description: 'Standard community-driven global road map (Free & Open Source).',
    keyRequired: false,
  },
  openfreemap: {
    id: 'openfreemap',
    name: 'OpenFreeMap',
    category: 'Free Vector / WebGL',
    tileUrl: 'https://tiles.openfreemap.org/styles/bright',
    attribution:
      '&copy; <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
    description: 'Ultra-fast vector map tiles rendered via MapLibre GL with clean Bright aesthetic.',
    keyRequired: false,
    isVector: true,
  },
  maptiler: {
    id: 'maptiler',
    name: 'MapTiler',
    category: 'Commercial / High-Res',
    tileUrl: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${DEFAULT_MAPTILER_KEY}`,
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    maxZoom: 20,
    description: 'High-detail professional cartography with rich POIs and landmarks.',
    keyRequired: true,
  },
  stadiamaps: {
    id: 'stadiamaps',
    name: 'Stadia Maps',
    category: 'Clean Minimalist',
    tileUrl: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${DEFAULT_STADIA_KEY}`,
    attribution:
      '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>',
    maxZoom: 20,
    description: 'Subtle Alidade Smooth theme, perfect for high-contrast vehicle telemetry overlays.',
    keyRequired: true,
  },
  longdomap: {
    id: 'longdomap',
    name: 'Longdo Map',
    category: 'Thai Localized',
    tileUrl: `https://ms.longdo.com/mmmap/img.php?zoom={z}&x={x}&y={y}&mode=icons&key=${DEFAULT_LONGDO_KEY}&proj=epsg3857&HD=1`,
    attribution:
      '&copy; <a href="https://map.longdo.com/" target="_blank" rel="noreferrer">Longdo Map</a>',
    maxZoom: 20,
    description: 'Premier Thai localized map with comprehensive building names and sois in Thailand.',
    keyRequired: true,
  },
};

export function getAllMapProviders(): MapProviderConfig[] {
  return Object.values(MAP_PROVIDERS);
}

export function getMapProvider(id: string): MapProviderConfig {
  return MAP_PROVIDERS[id] || MAP_PROVIDERS.osm;
}
