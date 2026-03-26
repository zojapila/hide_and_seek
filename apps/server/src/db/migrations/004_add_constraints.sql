-- Extend player name length from VARCHAR(20) to VARCHAR(50)
ALTER TABLE players ALTER COLUMN name TYPE VARCHAR(50);

-- Prevent duplicate player names within a game
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_game_name ON players (game_id, name);

-- Prevent duplicate OSM stops within a game
CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_game_osm ON stops (game_id, osm_id);
