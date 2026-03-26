-- Stops (cached from Overpass API per game)
CREATE TABLE IF NOT EXISTS stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  osm_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  geofence GEOGRAPHY(Polygon, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stops_game_id ON stops (game_id);
CREATE INDEX IF NOT EXISTS idx_stops_location ON stops USING GIST (location);

-- Add FK from players.chosen_stop_id to stops
ALTER TABLE players
  ADD CONSTRAINT fk_players_chosen_stop
  FOREIGN KEY (chosen_stop_id) REFERENCES stops(id)
  ON DELETE SET NULL;
