import type { Vehicle } from './types.ts';

export function maskApiKey(apiKey?: string | null): string {
  if (!apiKey) return '';
  if (apiKey.length < 15) return apiKey;
  const prefix = apiKey.substring(0, 8);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}...${suffix}`;
}

export function validateCommandPayload(command: string, params: any): boolean {
  switch (command) {
    case 'set_interval':
      if (typeof params?.interval !== 'number') return false;
      if (params.interval < 1000) return false;
      return true;
    case 'reboot':
    case 'check_ota':
      return true;
    default:
      return false;
  }
}

export function filterVehicles(
  vehicles: Vehicle[] | any[],
  searchQuery: string,
  routeFilter: string,
  statusFilter: string
): Vehicle[] {
  const query = searchQuery.toLowerCase().trim();

  return vehicles.filter(v => {
    // Search match
    const searchMatch = !query || 
      v.plate_number?.toLowerCase().includes(query) || 
      v.model?.toLowerCase().includes(query);

    // Route match
    let routeMatch = true;
    if (routeFilter !== 'all') {
      if (routeFilter === 'unassigned') {
        routeMatch = !v.current_route_id;
      } else {
        routeMatch = v.current_route_id === routeFilter;
      }
    }

    // Status match
    let statusMatch = true;
    if (statusFilter !== 'all') {
      statusMatch = v.status === statusFilter;
    }

    return searchMatch && routeMatch && statusMatch;
  });
}
