ALTER TABLE players
  ADD COLUMN phone               VARCHAR(20),
  ADD COLUMN gender               VARCHAR(20),
  ADD COLUMN years_experience     SMALLINT CHECK (years_experience >= 0),
  ADD COLUMN available_monday     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN available_wednesday  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN available_weekend    BOOLEAN NOT NULL DEFAULT false;
