CREATE UNIQUE INDEX matches_generation_week_hometeam_idx
  ON matches (generation_id, week, home_team_id);
