import React from 'react';
import StandingsTable from './StandingsTable';
import TopScorersPanel from './TopScorersPanel';
import NextMatchPanel from './NextMatchPanel';

function StandingsView({ season, onSelectTeam, onGoToSchedule }) {
  return (
    <div className="league-section">
      <div className="generated-header">
        <div className="generated-heading">
          <h3 className="panel-title">League Standings</h3>
          <span className="generated-subtitle">
            Monday Night League · Winter 2026 · Week {season.currentWeek} of{' '}
            {season.totalWeeks}
          </span>
        </div>
        <div className="league-tabs">
          <button className="tab-btn active">Standings</button>
          <button className="tab-btn" onClick={onGoToSchedule}>
            Schedule
          </button>
          <button className="tab-btn" title="Coming soon" disabled>
            Player Stats
          </button>
        </div>
      </div>

      <div className="league-grid">
        <StandingsTable standings={season.standings} onSelectTeam={onSelectTeam} />
        <div className="notify-sidebar">
          <TopScorersPanel topScorers={season.topScorers} />
          <NextMatchPanel nextMatch={season.nextMatch} />
        </div>
      </div>
    </div>
  );
}

export default StandingsView;
