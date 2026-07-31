import React from 'react';

function LeagueEmptyState({ onGoToTeams }) {
  return (
    <div className="panel empty-state">
      <p className="empty-state-title">No teams published yet</p>
      <p className="empty-state-subtitle">
        Generate and publish teams first to see league standings.
      </p>
      <button className="pill-btn pill-btn-blue" onClick={onGoToTeams}>
        Go to Team Generator
      </button>
    </div>
  );
}

export default LeagueEmptyState;
