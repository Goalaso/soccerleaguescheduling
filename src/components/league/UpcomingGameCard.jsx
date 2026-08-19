import React from 'react';
import { formatMatchDate } from '../../utils/season';

// Singular next scheduled match for this team specifically — distinct from
// MatchHistoryList above it, which only ever shows *played* games.
function UpcomingGameCard({ team, match, onSelectMatch }) {
  return (
    <div className="panel upcoming-game-panel">
      <h3 className="panel-title">Upcoming Game</h3>
      {match ? (
        <div
          className="upcoming-game-row upcoming-game-row-clickable"
          onClick={() => onSelectMatch(match.id)}
        >
          <span className="match-history-week">Week {match.week}</span>
          <span className="match-history-teams">
            {match.home.name} <span className="match-history-vs">vs</span> {match.away.name}
          </span>
          <span className="match-history-date">{formatMatchDate(match.date)}</span>
          <span className="match-history-chevron">&gt;</span>
        </div>
      ) : (
        <p className="empty-state-subtitle">No upcoming game scheduled for {team.name}.</p>
      )}
    </div>
  );
}

export default UpcomingGameCard;
