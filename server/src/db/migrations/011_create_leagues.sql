CREATE TABLE leagues (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO leagues (name) VALUES ('Premier'), ('Recreational');
