import React from 'react';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function TeamSummaryCard({ team, standing, rank, recentForm, topScorer, variant }) {
  const winRate = standing.mp ? Math.round((standing.w / standing.mp) * 100) : 0;
  const captain = team.players.find((p) => p.id === team.captainPlayerId);

  return (
    <div className="panel team-summary-card" style={{ '--team-color': team.color }}>
      <div className="team-summary-header">
        {variant === 'profile' && (
          <span className="team-summary-avatar">
            {team.name.replace('Team ', '').charAt(0)}
          </span>
        )}
        <div>
          <h4>{team.name}</h4>
          <p className="team-summary-subtitle">Monday Night League</p>
          {captain && <p className="team-summary-captain">Captain: {captain.name}</p>}
        </div>
      </div>

      {variant === 'history' && (
        <div className="team-summary-stats">
          <div>
            <span className="team-summary-stat-value">{standing.pts}</span>
            <span className="team-summary-stat-label">Points</span>
          </div>
          <div>
            <span className="team-summary-stat-value">{ordinal(rank)}</span>
            <span className="team-summary-stat-label">Position</span>
          </div>
          <div>
            <span
              className={`team-summary-stat-value ${standing.gd >= 0 ? 'gd-positive' : 'gd-negative'}`}
            >
              {standing.gd >= 0 ? '+' : ''}
              {standing.gd}
            </span>
            <span className="team-summary-stat-label">Goal Diff</span>
          </div>
        </div>
      )}

      {variant === 'profile' && (
        <div className="team-summary-stats">
          <div>
            <span className="team-summary-stat-value">{ordinal(rank)}</span>
            <span className="team-summary-stat-label">Position</span>
          </div>
          <div>
            <span className="team-summary-stat-value">{standing.pts}</span>
            <span className="team-summary-stat-label">Points</span>
          </div>
          <div>
            <span className="team-summary-stat-value">{standing.w}</span>
            <span className="team-summary-stat-label">Wins</span>
          </div>
          <div>
            <span
              className={`team-summary-stat-value ${standing.gd >= 0 ? 'gd-positive' : 'gd-negative'}`}
            >
              {standing.gd >= 0 ? '+' : ''}
              {standing.gd}
            </span>
            <span className="team-summary-stat-label">Goal Diff</span>
          </div>
        </div>
      )}

      <span className="option-label">Recent Form</span>
      <div className="form-badge-row">
        {recentForm.length === 0 && (
          <span className="team-summary-subtitle">No matches played yet</span>
        )}
        {recentForm.map((letter, i) => (
          <span key={i} className={`form-badge form-badge-${letter.toLowerCase()}`}>
            {letter}
          </span>
        ))}
      </div>

      {variant === 'history' && topScorer && (
        <div className="team-summary-extra">
          <div className="team-summary-extra-row">
            <span>Top Scorer</span>
            <span>
              {topScorer.name} ({topScorer.goals})
            </span>
          </div>
          <div className="team-summary-extra-row">
            <span>Goals For</span>
            <span>{standing.gf}</span>
          </div>
          <div className="team-summary-extra-row">
            <span>Goals Against</span>
            <span>{standing.ga}</span>
          </div>
          <div className="team-summary-extra-row">
            <span>Win Rate</span>
            <span className="gd-positive">{winRate}%</span>
          </div>
        </div>
      )}

      {variant === 'profile' && topScorer && (
        <div className="top-scorer-callout">
          <span className="option-label">Top Scorer</span>
          <p className="top-scorer-callout-name">{topScorer.name}</p>
          <p className="top-scorer-callout-position">{topScorer.position}</p>
          <p className="top-scorer-callout-goals">{topScorer.goals} goals</p>
        </div>
      )}
    </div>
  );
}

export default TeamSummaryCard;
