ALTER TABLE player_leagues DROP CONSTRAINT player_leagues_league_type_check;
ALTER TABLE player_leagues ADD CONSTRAINT player_leagues_league_type_check
  CHECK (league_type IN ('Premier', 'Recreational'));
