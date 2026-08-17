import React from 'react';
import { formatMatchDate, matchResultLetter } from '../../utils/season';

function MatchHistoryList({ team, matches, onSelectMatch }) {
  return (
    <div className="panel match-history-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Match History</h3>
        <span className="generated-subtitle">
          {matches.length} matches played · click a match to view details
        </span>
      </div>

      <div className="match-history-list">
        {matches.map((match) => {
          const letter = matchResultLetter(match, team.id);
          return (
            <div
              className="match-history-row match-history-row-clickable"
              key={`${match.week}`}
              onClick={() => onSelectMatch(match.id)}
            >
              <span className="match-history-week">Week {match.week}</span>
              <span className="match-history-teams">
                {match.home.name} <span className="match-history-vs">vs</span>{' '}
                {match.away.name}
              </span>
              <span className={`form-badge form-badge-${letter.toLowerCase()}`}>
                {letter}
              </span>
              <span className="match-history-score">
                {match.result.homeGoals} - {match.result.awayGoals}
              </span>
              <span className="match-history-date">
                {formatMatchDate(match.date)}
              </span>
              <span className="match-history-chevron">&gt;</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MatchHistoryList;
