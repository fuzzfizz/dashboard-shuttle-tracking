import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionStatus, FleetMap, TelemetryPayload, UseShuttleTelemetryOptions } from '../types/telemetry';
import { parseTelemetryPayload } from '../services/telemetryParser';

const DEFAULT_BROKER = import.meta.env.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8084/mqtt';
const DEFAULT_TOPIC = import.meta.env.VITE_MQTT_TOPIC || 'shuttle/fleet/v1/+/telemetry';
const DEFAULT_USERNAME = import.meta.env.VITE_MQTT_USERNAME;
const DEFAULT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD;

export function useShuttleTelemetry(options: UseShuttleTelemetryOptions = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER;
  const topic = options.topic || DEFAULT_TOPIC;
  const username = options.username || DEFAULT_USERNAME;
  const password = options.password || DEFAULT_PASSWORD;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [vehicles, setVehicles] = useState<FleetMap>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setStatus('connecting');
    const client: MqttClient = mqtt.connect(brokerUrl, {
      clientId: `shuttle_web_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    });

    client.on('connect', () => {
      setStatus('connected');
      client.subscribe(topic, (err) => {
        if (err) {
          console.error('MQTT subscribe error:', err);
          setStatus('error');
        }
      });
    });

    client.on('message', (_topic, message) => {
      const parsed = parseTelemetryPayload(message.toString());
      if (parsed) {
        const timestamp = Date.now();
        setNow(timestamp);
        setVehicles((prev) => ({
          ...prev,
          [parsed.vehicle_id]: parsed,
        }));
        setLastSeenMap((prev) => ({
          ...prev,
          [parsed.vehicle_id]: timestamp,
        }));
      }
    });

    client.on('error', (err) => {
      console.error('MQTT client error:', err);
      setStatus('error');
    });

    client.on('close', () => {
      setStatus('disconnected');
    });

    client.on('reconnect', () => {
      setStatus('connecting');
    });

    return () => {
      client.end(true);
    };
  }, [brokerUrl, topic]);

  // Backward compatibility helper
  const selectedVehicle = selectedVehicleId ? vehicles[selectedVehicleId] || null : null;
  const fallbackVehicle = Object.values(vehicles)[0] || null;
  const telemetry: TelemetryPayload | null = selectedVehicle || fallbackVehicle;
  const lastSeen: number | null = telemetry ? lastSeenMap[telemetry.vehicle_id] || null : null;

  return {
    status,
    vehicles,
    lastSeenMap,
    selectedVehicleId,
    setSelectedVehicleId,
    telemetry,
    lastSeen,
    now,
  };
}
