import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionStatus, TelemetryPayload, UseShuttleTelemetryOptions } from '../types/telemetry';
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
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

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
        setTelemetry(parsed);
        setLastSeen(Date.now());
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

  return { status, telemetry, lastSeen };
}
