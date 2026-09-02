import type { Vehicle, Trip, DailyReportSummary } from './types.ts';

export function computeFleetStats(vehicles: Vehicle[], trips: Trip[], dailyReports: DailyReportSummary[]) {
  const totalVehicles = vehicles.length;
  const onlineCount = vehicles.filter(v => v.status !== 'offline').length;
  const inTransitCount = vehicles.filter(v => v.status === 'in_transit').length;
  
  const totalKmToday = dailyReports.reduce((sum, report) => sum + Number(report.total_distance_km || 0), 0);
  
  const activeTripsCount = trips.filter(t => t.status === 'in_progress').length;
  
  return {
    totalVehicles,
    onlineCount,
    inTransitCount,
    totalKmToday: Number(totalKmToday.toFixed(1)),
    activeTripsCount
  };
}

export function filterAdminVehicles(vehicles: Vehicle[], searchQuery: string, statusFilter: string) {
  return vehicles.filter(v => {
    const matchesSearch = !searchQuery || 
      v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.current_route_id && v.current_route_id.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
}
