export function formatSpeed(speedKmH: number | null | undefined): string {
  if (speedKmH === null || speedKmH === undefined) return '0 km/h';
  return `${Math.round(speedKmH)} km/h`;
}

export function formatHeading(heading: number | null | undefined): string {
  if (heading === null || heading === undefined) return 'N/A';
  const val = Math.floor((heading / 22.5) + 0.5);
  const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return arr[(val % 16)];
}

export function filterVehicles(
  vehicles: any[],
  routeIdFilter: string | null,
  searchQuery: string
) {
  return vehicles.filter(v => {
    const matchesRoute = routeIdFilter === 'all' || !routeIdFilter || v.current_route_id === routeIdFilter;
    const matchesSearch = !searchQuery || v.plate_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRoute && matchesSearch;
  });
}

export function updateVehicleLocation(
  vehicles: any[],
  payload: any
) {
  const index = vehicles.findIndex(v => v.id === payload.vehicle_id);
  if (index === -1) return vehicles;

  const newVehicles = [...vehicles];
  newVehicles[index] = {
    ...newVehicles[index],
    last_lat: payload.lat,
    last_lng: payload.lng,
    last_speed: payload.speed_kmh,
    last_heading: payload.heading,
    last_seen_at: payload.timestamp,
    status: payload.status || newVehicles[index].status
  };
  return newVehicles;
}

export function formatDistance(km?: number | null): string {
  if (km === null || km === undefined || isNaN(km) || km <= 0) {
    return '0.0 กม.';
  }
  return `${Number(km).toFixed(1)} กม.`;
}

export function filterFleet(
  vehicles: any[] | null | undefined,
  query: string = '',
  status: string = 'all',
  routeId: string | null = 'all'
): any[] {
  if (!Array.isArray(vehicles)) return [];

  const q = (query || '').trim().toLowerCase();
  const normalizedStatusFilter = (status || 'all').trim().toLowerCase().replace(/\s+/g, '_');
  const targetRoute = routeId || 'all';

  return vehicles.filter(v => {
    if (!v) return false;

    // Status filter
    if (normalizedStatusFilter !== 'all' && normalizedStatusFilter !== '') {
      const vStatus = (v.status || '').toLowerCase().replace(/\s+/g, '_');
      if (vStatus !== normalizedStatusFilter) {
        return false;
      }
    }

    // Route filter
    const vehicleRouteId = v.route_id ?? v.current_route_id ?? null;
    if (targetRoute !== 'all' && targetRoute !== '') {
      if (targetRoute === 'unassigned') {
        if (vehicleRouteId) return false;
      } else if (vehicleRouteId !== targetRoute) {
        return false;
      }
    }

    // Search query filter
    if (q) {
      const matchPlate = v.plate_number ? String(v.plate_number).toLowerCase().includes(q) : false;
      const matchModel = v.model ? String(v.model).toLowerCase().includes(q) : false;
      const matchName = v.name ? String(v.name).toLowerCase().includes(q) : false;
      const matchRoute = v.route_name ? String(v.route_name).toLowerCase().includes(q) : false;
      return matchPlate || matchModel || matchName || matchRoute;
    }

    return true;
  });
}
