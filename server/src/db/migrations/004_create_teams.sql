CREATE TABLE teams (
  id            SERIAL PRIMARY KEY,
  generation_id INTEGER NOT NULL REFERENCES team_generations(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  color         VARCHAR(7) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
