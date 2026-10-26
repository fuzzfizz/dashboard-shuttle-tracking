import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Client } = pg;
const migrationPath = path.resolve(__dirname, '../docs/migrations/001_daily_metrics_and_logs.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

const client = new Client({
  host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres.ygpbohvmqkarrrixqdcf',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    await client.connect();
    console.log(`Connected to Supabase PostgreSQL database at ${client.host}:${client.port}`);
    console.log('Applying migration from:', migrationPath);
    await client.query(sql);
    console.log('Migration applied successfully!');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('daily_vehicle_metrics', 'telemetry_logs');
    `);
    console.log('Tables found in public schema:', res.rows.map(r => r.table_name));

    const policiesRes = await client.query(`
      SELECT policyname, tablename, cmd, roles 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    console.log('RLS Policies:', policiesRes.rows);

    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
