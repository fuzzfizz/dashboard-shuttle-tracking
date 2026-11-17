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
  alternativePaths?: Array<Array<[number, number]>>; // divergent alternative branches [lat, lng][] with overlapping hidden
  distanceMeters?: number;
  durationSeconds?: number;
  createdAt: number;
}

export type MapPinMode = 'idle' | 'pick-pickup' | 'pick-dropoff';

export type TripRoundStage = 'waiting-pickup' | 'in-transit' | 'arrived-dropoff';

