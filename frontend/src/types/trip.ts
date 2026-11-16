export interface TripLocation {
  lat: number;
  lng: number;
  name?: string;
}

export interface VehicleTrip {
  vehicleId: string;
  pickup: TripLocation;
  dropoff: TripLocation;
  plannedPath: Array<[number, number]>; // [lat, lng]
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt: number;
}

export type MapPinMode = 'idle' | 'pick-pickup' | 'pick-dropoff';
