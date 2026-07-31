-- Evolve team_generations into seasons: real league link, a pre-team-generation
-- lifecycle stage, and support for many historical rows instead of one global
-- "active" row.

-- Two leftover rows from earlier manual testing (no matches ever generated
-- for them) — drop them so they don't show up as confusing fake history in
-- the new season dropdown. Cascades harmlessly to their teams/team_players.
DELETE FROM team_generations
WHERE id NOT IN (SELECT DISTINCT generation_id FROM matches);

ALTER TABLE team_generations RENAME TO seasons;

ALTER TABLE teams RENAME COLUMN generation_id TO season_id;
ALTER TABLE matches RENAME COLUMN generation_id TO season_id;
ALTER INDEX matches_generation_week_idx RENAME TO matches_season_week_idx;
ALTER INDEX matches_generation_week_hometeam_idx RENAME TO matches_season_week_hometeam_idx;

-- Real league link, backfilled from the old free-text league_type (which
-- predates the real `leagues` table and was never kept in sync with league
-- renames) — fall back to the first league for anything unmatched.
ALTER TABLE seasons ADD COLUMN league_id INTEGER REFERENCES leagues(id) ON DELETE RESTRICT;
UPDATE seasons SET league_id = COALESCE(
  (SELECT id FROM leagues WHERE name = seasons.league_type),
  (SELECT id FROM leagues ORDER BY id LIMIT 1)
);
ALTER TABLE seasons ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE seasons DROP COLUMN league_type;

-- Lifecycle: a season collects availability before teams exist, then is
-- permanent history once teams are generated. Replaces is_active — any
-- number of teams_generated seasons can coexist per league (that's the
-- browsable history), but only one collecting_availability at a time.
CREATE TYPE season_status AS ENUM ('collecting_availability', 'teams_generated');
ALTER TABLE seasons ADD COLUMN status season_status NOT NULL DEFAULT 'collecting_availability';
UPDATE seasons SET status = 'teams_generated';

DROP INDEX one_active_generation;
ALTER TABLE seasons DROP COLUMN is_active;
CREATE UNIQUE INDEX one_open_season_per_league ON seasons (league_id) WHERE status = 'collecting_availability';

ALTER TABLE seasons ADD COLUMN name VARCHAR(100);
ALTER TABLE seasons ADD COLUMN starts_on DATE;
UPDATE seasons s SET
  name = 'Season ' || s.id,
  starts_on = (SELECT MIN(match_date) FROM matches m WHERE m.season_id = s.id);
