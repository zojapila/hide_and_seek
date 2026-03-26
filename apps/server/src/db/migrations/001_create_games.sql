-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Game status enum
DO $$ BEGIN
  CREATE TYPE game_status AS ENUM ('waiting', 'hiding', 'seeking', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) NOT NULL UNIQUE,
  status game_status NOT NULL DEFAULT 'waiting',
  hide_time_minutes INT NOT NULL DEFAULT 30,
  geofence_radius_m INT NOT NULL DEFAULT 200,
  game_radius_m INT NOT NULL DEFAULT 3000,
  started_at TIMESTAMPTZ,
  seeking_started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  center_point GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_code ON games (code);
