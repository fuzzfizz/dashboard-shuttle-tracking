import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionStatus, FleetMap, TelemetryPayload, UseShuttleTelemetryOptions } from '../types/telemetry';
import { parseTelemetryPayload } from '../services/telemetryParser';
import {
  loadLastKnownVehicles,
  saveLastKnownVehicles,
  fetchLastKnownTelemetry,
} from '../services/telemetryStorage';

const DEFAULT_BROKER = import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt';
const DEFAULT_TOPIC = import.meta.env.VITE_MQTT_TOPIC || 'shuttle/+';
const DEFAULT_USERNAME = import.meta.env.VITE_MQTT_USERNAME;
const DEFAULT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD;
const DEFAULT_STREAM_URL = import.meta.env.VITE_TELEMETRY_STREAM_URL || '/api/telemetry/stream';

const isHttpOrRelativeUrl = (url: string) =>
  url.startsWith('http://') ||
  url.startsWith('https://') ||
  url.startsWith('/') ||
  url.includes('/api/telemetry');

export function useShuttleTelemetry(options: UseShuttleTelemetryOptions = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER;
  const topic = options.topic || DEFAULT_TOPIC;
  const username = options.username || DEFAULT_USERNAME;
  const password = options.password || DEFAULT_PASSWORD;
  const streamUrl = options.streamUrl || (isHttpOrRelativeUrl(brokerUrl) ? brokerUrl : DEFAULT_STREAM_URL);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [useSseFallback, setUseSseFallback] = useState(false);
  const [vehicles, setVehicles] = useState<FleetMap>(() => loadLastKnownVehicles());
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>(() => {
    const initial = loadLastKnownVehicles();
    const map: Record<string, number> = {};
    for (const [id, v] of Object.entries(initial)) {
      map[id] = v.timestamp || 0;
    }
    return map;
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Ingestion handler shared between MQTT and SSE
  const handleIncomingTelemetry = (parsed: TelemetryPayload | null) => {
    if (!parsed) return;
    const timestamp = Date.now();
    setNow(timestamp);
    setVehicles((prev) => {
      const updated = {
        ...prev,
        [parsed.vehicle_id]: parsed,
      };
      saveLastKnownVehicles(updated);
      return updated;
    });
    setLastSeenMap((prev) => ({
      ...prev,
      [parsed.vehicle_id]: timestamp,
    }));
  };

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch last known telemetry from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    fetchLastKnownTelemetry().then((remoteFleet) => {
      if (!isMounted) return;
      if (remoteFleet && Object.keys(remoteFleet).length > 0) {
        setVehicles((prev) => {
          const merged = { ...remoteFleet, ...prev };
          saveLastKnownVehicles(merged);
          return merged;
        });
        setLastSeenMap((prev) => {
          const next = { ...prev };
          for (const [id, v] of Object.entries(remoteFleet)) {
            if (!next[id] || v.timestamp > next[id]) {
              next[id] = v.timestamp;
            }
          }
          return next;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time connection: SSE or MQTT
  const shouldUseSse =
    options.mode === 'sse' ||
    Boolean(options.streamUrl) ||
    isHttpOrRelativeUrl(brokerUrl) ||
    useSseFallback ||
    (typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      brokerUrl.startsWith('ws://localhost'));

  useEffect(() => {
    setStatus('connecting');

    if (shouldUseSse) {
      if (typeof EventSource === 'undefined') {
        console.warn('EventSource is not supported in this environment.');
        setStatus('error');
        return;
      }

      const eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        setStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const raw = event.data;
          if (!raw || raw.startsWith(':')) return;
          const parsed = parseTelemetryPayload(raw);
          if (parsed) {
            handleIncomingTelemetry(parsed);
          }
        } catch (err) {
          console.warn('[SSE Stream] Failed to parse message:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setStatus('disconnected');
        } else {
          // EventSource will auto-reconnect
          setStatus('connecting');
        }
      };

      return () => {
        eventSource.close();
      };
    }

    // Default: MQTT WebSocket client
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

    client.on('message', (msgTopic, message) => {
      const parsed = parseTelemetryPayload(message.toString(), msgTopic);
      if (parsed) {
        handleIncomingTelemetry(parsed);
      }
    });

    client.on('error', (err) => {
      console.error('MQTT client error:', err);
      if (!useSseFallback && typeof EventSource !== 'undefined') {
        console.warn('[Telemetry] MQTT connection failed, falling back to backend SSE stream...');
        setUseSseFallback(true);
      } else {
        setStatus('error');
      }
    });

    client.on('close', () => {
      if (!useSseFallback) {
        setStatus('disconnected');
      }
    });

    client.on('reconnect', () => {
      if (!useSseFallback) {
        setStatus('connecting');
      }
    });

    return () => {
      client.end(true);
    };
  }, [brokerUrl, topic, streamUrl, shouldUseSse, useSseFallback]);

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
