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
