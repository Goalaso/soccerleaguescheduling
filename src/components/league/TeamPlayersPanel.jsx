import React from 'react';

// Compact per-team stats card — replaces the old per-team "Player Stats"
// link-through; same team-scoped goals data TeamSummaryCard/RosterTable
// already use (never a loaned player's goals from another team).
function TeamPlayersPanel({ players, teamGoals, gamesPlayedByPlayer }) {
  const rows = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      goals: teamGoals[p.id] || 0,
      gamesPlayed: gamesPlayedByPlayer[p.id] || 0,
    }))
    .sort((a, b) => b.goals - a.goals || b.gamesPlayed - a.gamesPlayed);

  return (
    <div className="panel sidebar-card">
      <h3 className="panel-title">Top Players</h3>
      {rows.map((p, index) => (
        <div className="top-scorer-row" key={p.id}>
          <span className="top-scorer-rank">{index + 1}</span>
          <span className="top-scorer-info">
            <span className="player-name">{p.name}</span>
            <span className="top-scorer-team">{p.gamesPlayed} games</span>
          </span>
          <span className="top-scorer-goals">{p.goals}g</span>
        </div>
      ))}
    </div>
  );
}

export default TeamPlayersPanel;
