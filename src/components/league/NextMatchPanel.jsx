import React from 'react';
import { formatMatchDate } from '../../utils/season';

function NextMatchPanel({ nextMatch }) {
  return (
    <div className="panel sidebar-card">
      <h3 className="panel-title">Next Match</h3>
      {!nextMatch && <p className="team-summary-subtitle">Season complete</p>}
      {nextMatch && (
        <>
          <span className="badge badge-count">
            Week {nextMatch.week} · {formatMatchDate(nextMatch.date)}
          </span>
          <div className="next-match-teams">
            <span className="next-match-team">{nextMatch.home.name}</span>
            <span className="next-match-vs">vs</span>
            <span className="next-match-team">{nextMatch.away.name}</span>
          </div>
          <p className="team-summary-subtitle">
            5:00 PM · Boeing Indoor Soccer Center
          </p>
        </>
      )}
    </div>
  );
}

export default NextMatchPanel;
