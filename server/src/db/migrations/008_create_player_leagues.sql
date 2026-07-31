CREATE TABLE player_leagues (
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league_type VARCHAR(20) NOT NULL CHECK (league_type IN ('Competitive', 'Recreational')),
  PRIMARY KEY (player_id, league_type)
);
