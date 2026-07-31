CREATE TABLE team_players (
  team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score     NUMERIC(5,2),
  PRIMARY KEY (team_id, player_id)
);

CREATE INDEX team_players_player_idx ON team_players (player_id);
