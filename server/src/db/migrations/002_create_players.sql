CREATE TABLE players (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       VARCHAR(255) NOT NULL,
  position   VARCHAR(20) NOT NULL CHECK (position IN ('Goalkeeper','Forward','Midfielder','Defender')),
  skill      SMALLINT NOT NULL CHECK (skill BETWEEN 1 AND 10),
  age        SMALLINT NOT NULL CHECK (age > 0),
  email      VARCHAR(255) NOT NULL,
  has_phone  BOOLEAN NOT NULL DEFAULT false,
  has_app    BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
