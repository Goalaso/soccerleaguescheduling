CREATE TYPE match_status AS ENUM ('scheduled', 'played', 'postponed', 'cancelled');

CREATE TABLE matches (
  id            SERIAL PRIMARY KEY,
  generation_id INTEGER NOT NULL REFERENCES team_generations(id) ON DELETE CASCADE,
  week          SMALLINT NOT NULL,
  match_date    DATE NOT NULL,
  home_team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status        match_status NOT NULL DEFAULT 'scheduled',
  home_goals    SMALLINT,
  away_goals    SMALLINT,
  recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id)
);

CREATE TABLE match_goals (
  id         SERIAL PRIMARY KEY,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  goals      SMALLINT NOT NULL DEFAULT 1 CHECK (goals > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX matches_generation_week_idx ON matches (generation_id, week);
