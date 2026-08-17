CREATE TABLE match_score_submissions (
  match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  home_goals   SMALLINT NOT NULL CHECK (home_goals >= 0),
  away_goals   SMALLINT NOT NULL CHECK (away_goals >= 0),
  scorers      JSONB NOT NULL DEFAULT '[]',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, team_id)
);
