# Task 2 Brief: Supabase Schema Migration Script & Resilient Client Setup

## Files:
- Create: `docs/migrations/001_daily_metrics_and_logs.sql`
- Create: `frontend/src/types/metrics.ts`
- Create: `frontend/src/services/supabaseClient.ts`
- Create: `frontend/src/services/__tests__/supabaseClient.test.ts`
- Modify: `frontend/package.json` (install `@supabase/supabase-js`)

## Interfaces:
- In `frontend/src/types/metrics.ts`:
  ```typescript
  export interface DailyVehicleMetric {
    vehicle_id: string;
    date: string; // 'YYYY-MM-DD'
    total_distance_km: number;
    max_speed_kmh: number;
    avg_speed_kmh: number;
    active_minutes: number;
    last_updated_at: string;
  }

  export type DailyMetricsMap = Record<string, DailyVehicleMetric>;
  ```
- In `frontend/src/services/supabaseClient.ts`:
  - `isSupabaseConfigured(): boolean`
  - `getSupabaseClient(): SupabaseClient | null`

## Global Constraints:
- Resilient client: Never crash or throw if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are undefined or empty; return `null` client safely.
- SQL Migration must be valid PostgreSQL / Supabase SQL with RLS enabled and indexes.
- All tests must pass with clean output.

## Steps:

### Step 1: Install `@supabase/supabase-js` in frontend
Run: `cd frontend && npm install @supabase/supabase-js`

### Step 2: Create SQL migration `docs/migrations/001_daily_metrics_and_logs.sql`
```sql
-- 1. Daily Vehicle Metrics Table
CREATE TABLE IF NOT EXISTS daily_vehicle_metrics (
    vehicle_id VARCHAR(64) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    max_speed_kmh NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    avg_speed_kmh NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    active_minutes INT NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_vehicle_metrics (date DESC);

-- 2. Telemetry Logs Table
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    heading NUMERIC(5, 2) DEFAULT 0.00,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_time ON telemetry_logs (vehicle_id, recorded_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE daily_vehicle_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_vehicle_metrics"
    ON daily_vehicle_metrics FOR SELECT USING (true);

CREATE POLICY "Public read telemetry_logs"
    ON telemetry_logs FOR SELECT USING (true);

CREATE POLICY "Service write daily_vehicle_metrics"
    ON daily_vehicle_metrics FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Service write telemetry_logs"
    ON telemetry_logs FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
```

### Step 3: Create `frontend/src/types/metrics.ts`
Define `DailyVehicleMetric` and `DailyMetricsMap`.

### Step 4: Create `frontend/src/services/supabaseClient.ts`
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance && supabaseUrl && supabaseAnonKey) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return clientInstance;
}
```

### Step 5: Create `frontend/src/services/__tests__/supabaseClient.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured, getSupabaseClient } from '../supabaseClient';

describe('supabaseClient', () => {
  it('returns false and null client when environment variables are not set', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });
});
```

### Step 6: Verify and Commit
Run: `cd frontend; npx vitest run src/services/__tests__/supabaseClient.test.ts`
Expected: PASS
Commit:
```bash
git add docs/migrations/001_daily_metrics_and_logs.sql frontend/package.json frontend/package-lock.json frontend/src/types/metrics.ts frontend/src/services/supabaseClient.ts frontend/src/services/__tests__/supabaseClient.test.ts
git commit -m "feat: add supabase migration schema and resilient client configuration"
```
