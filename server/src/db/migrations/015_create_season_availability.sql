CREATE TABLE season_availability (
  season_id    INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_available BOOLEAN,
  responded_at TIMESTAMPTZ,
  marked_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (season_id, player_id)
);

CREATE INDEX season_availability_player_idx ON season_availability (player_id);
