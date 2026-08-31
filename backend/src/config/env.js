import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgres://shuttle:shuttle_secret_dev@localhost:5432/shuttle_tracking',
  JWT_SECRET: process.env.JWT_SECRET || 'shuttle_jwt_super_secret_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  CORS_ORIGIN: process.env.CORS_ORIGIN || true,
};

export default config;
