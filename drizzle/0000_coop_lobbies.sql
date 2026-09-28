CREATE TABLE IF NOT EXISTS lobbies (code TEXT PRIMARY KEY, state_json TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lobby_players (lobby_code TEXT NOT NULL, player_id TEXT NOT NULL, name TEXT NOT NULL, x REAL NOT NULL DEFAULT 0, z REAL NOT NULL DEFAULT 88, yaw REAL NOT NULL DEFAULT 0, seen_at INTEGER NOT NULL, PRIMARY KEY (lobby_code, player_id), FOREIGN KEY (lobby_code) REFERENCES lobbies(code) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS lobby_players_seen ON lobby_players(lobby_code, seen_at);
