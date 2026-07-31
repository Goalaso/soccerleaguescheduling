import React from 'react';

function StandingsTable({ standings, onSelectTeam }) {
  return (
    <div className="panel standings-panel">
      <div className="standings-table">
        <div className="standings-row standings-head">
          <span>#</span>
          <span>Team</span>
          <span>MP</span>
          <span>W</span>
          <span>D</span>
          <span>L</span>
          <span>GD</span>
          <span>GF</span>
          <span>PTS</span>
        </div>
        {standings.map((row, index) => (
          <div
            key={row.team.id}
            className="standings-row standings-row-clickable"
            onClick={() => onSelectTeam(row.team.id)}
          >
            <span>{index + 1}</span>
            <span className="team-name-cell">
              <span className="team-dot" style={{ background: row.team.color }} />
              {row.team.name}
            </span>
            <span>{row.mp}</span>
            <span>{row.w}</span>
            <span>{row.d}</span>
            <span>{row.l}</span>
            <span className={row.gd >= 0 ? 'gd-positive' : 'gd-negative'}>
              {row.gd >= 0 ? '+' : ''}
              {row.gd}
            </span>
            <span>{row.gf}</span>
            <span className="standings-pts">{row.pts}</span>
          </div>
        ))}
      </div>
      <p className="standings-legend">
        MP = Matches Played · W = Won · D = Drawn · L = Lost · GD = Goal
        Difference · GF = Goals For · PTS = Points
      </p>
    </div>
  );
}

export default StandingsTable;
