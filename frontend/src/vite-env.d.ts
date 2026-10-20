/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MQTT_BROKER_URL?: string;
  readonly VITE_MQTT_TOPIC?: string;
  readonly VITE_MQTT_USERNAME?: string;
  readonly VITE_MQTT_PASSWORD?: string;
  readonly VITE_CARTO_API_KEY?: string;
  readonly VITE_TILE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
