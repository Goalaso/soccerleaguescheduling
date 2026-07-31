-- player_leagues has no rows yet (nothing has written to it), so this is
-- a clean structural swap rather than a data migration.
DROP TABLE player_leagues;

CREATE TABLE player_leagues (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, league_id)
);

CREATE INDEX player_leagues_league_idx ON player_leagues (league_id);
