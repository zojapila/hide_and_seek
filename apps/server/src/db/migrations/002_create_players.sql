-- Player role enum
DO $$ BEGIN
  CREATE TYPE player_role AS ENUM ('hider', 'seeker');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(20) NOT NULL,
  role player_role NOT NULL,
  current_location GEOGRAPHY(Point, 4326),
  chosen_stop_id UUID,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_game_id ON players (game_id);
