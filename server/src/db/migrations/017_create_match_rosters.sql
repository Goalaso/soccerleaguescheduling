CREATE TABLE match_rosters (
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source     VARCHAR(10) NOT NULL DEFAULT 'regular' CHECK (source IN ('regular', 'sub', 'borrowed')),
  goals      SMALLINT NOT NULL DEFAULT 0 CHECK (goals >= 0),
  added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX match_rosters_player_idx ON match_rosters (player_id);

ALTER TABLE teams ADD COLUMN captain_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;

-- Backfill roster rows for matches already played before this table existed,
-- so a future season-long roster move can't retroactively change who a past
-- match's goals/stats are attributed to. Best-effort: current team_players
-- as of today, since no attendance/subs/moves have ever happened before now.
INSERT INTO match_rosters (match_id, team_id, player_id, source)
SELECT m.id, tp.team_id, tp.player_id, 'regular'
FROM matches m
JOIN team_players tp ON tp.team_id IN (m.home_team_id, m.away_team_id)
WHERE m.status = 'played'
ON CONFLICT DO NOTHING;

-- Fold existing recorded goals into the new table, then retire match_goals —
-- every match_goals row's player was necessarily on that team's roster at
-- the time (existing scorer validation already guaranteed this), so this
-- join can't miss rows.
UPDATE match_rosters mr SET goals = mg.goals
FROM match_goals mg
WHERE mr.match_id = mg.match_id AND mr.player_id = mg.player_id;

DROP TABLE match_goals;
