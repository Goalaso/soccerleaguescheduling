CREATE TABLE team_generations (
  id                  SERIAL PRIMARY KEY,
  league_type         VARCHAR(50),
  num_teams           SMALLINT NOT NULL,
  players_per_team    SMALLINT NOT NULL,
  balance_by_skill    BOOLEAN NOT NULL DEFAULT false,
  balance_by_age      BOOLEAN NOT NULL DEFAULT false,
  balance_by_position BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_generation ON team_generations (is_active) WHERE is_active;
