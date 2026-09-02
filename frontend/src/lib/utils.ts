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
