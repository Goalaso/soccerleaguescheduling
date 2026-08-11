import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Every player across every team in the season, with goals scored *for
// that team* (season.teamPlayerGoals — never a loaned player's goals for
// someone else's team) and games played (from the new match_rosters-backed
// stats endpoint). Entering from a specific team's "Player Stats" button
// pre-filters via ?team=; the league-wide tab leaves it unfiltered.
function PlayerStatsView({ season, gamesPlayedByPlayer, onBack }) {
  const [searchParams] = useSearchParams();
  const teamFilter = searchParams.get('team');
  const [sortKey, setSortKey] = useState('goals');

  const rows = useMemo(() => {
    const all = season.standings.flatMap(({ team }) =>
      team.players.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: team.id,
        teamName: team.name,
        goals: (season.teamPlayerGoals[team.id] || {})[p.id] || 0,
        gamesPlayed: gamesPlayedByPlayer[p.id] || 0,
      }))
    );
    const filtered = teamFilter ? all.filter((r) => String(r.teamId) === teamFilter) : all;
    return [...filtered].sort((a, b) => b[sortKey] - a[sortKey] || a.name.localeCompare(b.name));
  }, [season, gamesPlayedByPlayer, teamFilter, sortKey]);

  const filteredTeamName = teamFilter
    ? season.standings.find((s) => String(s.team.id) === teamFilter)?.team.name
    : null;

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Standings
        </button>
        <span className="notify-breadcrumb-title">Player Stats</span>
        {filteredTeamName && <span className="generated-subtitle">{filteredTeamName}</span>}
      </div>

      <div className="panel players-panel">
        <div className="player-table">
          <div className="player-table-row player-table-head">
            <span>Player</span>
            <span>Team</span>
            <span>
              <button
                type="button"
                className="link-btn"
                onClick={() => setSortKey('gamesPlayed')}
              >
                Games{sortKey === 'gamesPlayed' ? ' ▾' : ''}
              </button>
            </span>
            <span>
              <button type="button" className="link-btn" onClick={() => setSortKey('goals')}>
                Goals{sortKey === 'goals' ? ' ▾' : ''}
              </button>
            </span>
          </div>
          <div className="player-table-body">
            {rows.map((r) => (
              <div className="player-table-row" key={r.id}>
                <span className="player-name">{r.name}</span>
                <span>{r.teamName}</span>
                <span>{r.gamesPlayed}</span>
                <span>{r.goals}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerStatsView;
