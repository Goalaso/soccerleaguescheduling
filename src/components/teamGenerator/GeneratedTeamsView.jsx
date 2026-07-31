import React from 'react';
import TeamCard from './TeamCard';

function GeneratedTeamsView({ teams, playerCount, isPublished, publishError, onRegenerate, onPublish }) {
  return (
    <div className="panel generated-panel">
      <div className="generated-header">
        <div className="generated-heading">
          <h3 className="panel-title">Generated Teams</h3>
          <span className="badge badge-count">{teams.length} Teams</span>
          <span className="generated-subtitle">
            Monday Night League · Winter 2026 · {playerCount} players
          </span>
        </div>
        <div className="generated-actions">
          <button className="outline-btn" onClick={onRegenerate}>
            Regenerate
          </button>
          <button className="outline-btn" title="Editing coming soon" disabled>
            Edit Teams
          </button>
          {!isPublished && (
            <button className="pill-btn pill-btn-blue" onClick={onPublish}>
              Save &amp; Publish
            </button>
          )}
        </div>
      </div>

      {publishError && <p className="options-warning">{publishError}</p>}

      <div className="team-grid">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}

export default GeneratedTeamsView;
