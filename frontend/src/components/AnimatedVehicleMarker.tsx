import React, { useEffect, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { TelemetryPayload } from '../types/telemetry';
import { createVehicleIcon } from './ShuttleMap';
import { lerpCoordinate, isJumpTooLarge, shortestAngleDelta } from '../services/markerInterpolation';
import {
  calculateBearing,
  haversineDistance,
  JITTER_THRESHOLD_KM
} from '../services/distanceCalculator';

export interface AnimatedVehicleMarkerProps {
  vehicle: TelemetryPayload;
  isSelected?: boolean;
  isOnline?: boolean;
  onSelectVehicle?: (vehicleId: string) => void;
  jumpThresholdKm?: number;
}

/**
 * AnimatedVehicleMarker renders a vehicle marker that glides smoothly at 60 FPS
 * between telemetry coordinates using requestAnimationFrame and direct Leaflet setLatLng calls.
 */
export const AnimatedVehicleMarker: React.FC<AnimatedVehicleMarkerProps> = ({
  vehicle,
  isSelected = false,
  isOnline = true,
  onSelectVehicle,
  jumpThresholdKm = 2.0,
}) => {
  const markerRef = useRef<L.Marker | null>(null);

  // Position tracking
  const currentCoordRef = useRef<[number, number]>([vehicle.lat, vehicle.lng]);
  const prevCoordRef = useRef<[number, number]>([vehicle.lat, vehicle.lng]);
  const targetCoordRef = useRef<[number, number]>([vehicle.lat, vehicle.lng]);

  // Heading tracking
  const initialHeading = vehicle.heading ?? 0;
  const lastHeadingRef = useRef<number>(initialHeading);
  const cumulativeHeadingRef = useRef<number>(initialHeading);
  const prevVehicleRef = useRef<TelemetryPayload>(vehicle);

  // Timing tracking
  const startTimeRef = useRef<number>(performance.now());
  const durationRef = useRef<number>(5000);
  const prevTimestampRef = useRef<number>(vehicle.timestamp);
  const animFrameRef = useRef<number | null>(null);

  // Process heading update on telemetry changes
  const prevVehicle = prevVehicleRef.current;
  const hasTelemetryUpdated =
    vehicle !== prevVehicle &&
    (prevVehicle.lat !== vehicle.lat ||
      prevVehicle.lng !== vehicle.lng ||
      prevVehicle.heading !== vehicle.heading ||
      prevVehicle.speed !== vehicle.speed ||
      prevVehicle.timestamp !== vehicle.timestamp);

  if (hasTelemetryUpdated) {
    const newTarget: [number, number] = [vehicle.lat, vehicle.lng];
    const prevCoord = prevCoordRef.current;
    const dist = haversineDistance(prevCoord[0], prevCoord[1], newTarget[0], newTarget[1]);
    
    let targetHeading: number;
    if (vehicle.heading !== undefined && vehicle.heading !== null && vehicle.heading > 0) {
      targetHeading = vehicle.heading;
    } else if (dist > JITTER_THRESHOLD_KM) {
      targetHeading = Math.round(calculateBearing(prevCoord[0], prevCoord[1], newTarget[0], newTarget[1]));
    } else {
      targetHeading = lastHeadingRef.current;
    }

    const angleDiff = shortestAngleDelta(cumulativeHeadingRef.current, targetHeading);
    cumulativeHeadingRef.current += angleDiff;
    lastHeadingRef.current = targetHeading;
    prevVehicleRef.current = vehicle;
  }

  useEffect(() => {
    const newTarget: [number, number] = [vehicle.lat, vehicle.lng];
    const prevTarget = targetCoordRef.current;

    // Check if coordinates changed
    if (newTarget[0] === prevTarget[0] && newTarget[1] === prevTarget[1]) {
      return;
    }

    // Teleport guard: If jump is too large (e.g. testing in a new city or initial reset),
    // snap immediately without gliding across the country.
    if (isJumpTooLarge(currentCoordRef.current, newTarget, jumpThresholdKm)) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      currentCoordRef.current = newTarget;
      prevCoordRef.current = newTarget;
      targetCoordRef.current = newTarget;
      if (markerRef.current) {
        markerRef.current.setLatLng(newTarget);
        const el = markerRef.current.getElement();
        if (el) {
          el.dataset.lat = newTarget[0].toFixed(6);
          el.dataset.lng = newTarget[1].toFixed(6);
        }
      }
      return;
    }

    // Smooth gliding between current actual position and new target
    prevCoordRef.current = [...currentCoordRef.current] as [number, number];
    targetCoordRef.current = newTarget;

    // Calculate dynamic duration based on packet timestamp delta, clamped between 1s and 10s
    const timeDelta = vehicle.timestamp - prevTimestampRef.current;
    durationRef.current = timeDelta >= 1000 && timeDelta <= 10000 ? timeDelta : 5000;
    prevTimestampRef.current = vehicle.timestamp;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1.0, elapsed / durationRef.current);
      const interpolated = lerpCoordinate(prevCoordRef.current, targetCoordRef.current, progress);
      currentCoordRef.current = interpolated;

      if (markerRef.current) {
        markerRef.current.setLatLng(interpolated);
        const el = markerRef.current.getElement();
        if (el) {
          el.dataset.lat = interpolated[0].toFixed(6);
          el.dataset.lng = interpolated[1].toFixed(6);
        }
      }

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        prevCoordRef.current = targetCoordRef.current;
      }
    };

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [vehicle.lat, vehicle.lng, vehicle.timestamp, jumpThresholdKm]);

  // Clean up any remaining animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  const icon = createVehicleIcon(
    cumulativeHeadingRef.current,
    isSelected,
    vehicle.vehicle_id,
    isOnline
  );

  return (
    <Marker
      ref={markerRef}
      position={currentCoordRef.current}
      icon={icon}
      eventHandlers={{
        click: () => onSelectVehicle?.(vehicle.vehicle_id),
      }}
    >
      <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
        <div className="text-xs font-sans">
          <strong>{vehicle.vehicle_id}</strong>
          <br />
          Speed: {(vehicle.speed ?? 0).toFixed(1)} km/h
        </div>
      </Tooltip>
    </Marker>
  );
};
