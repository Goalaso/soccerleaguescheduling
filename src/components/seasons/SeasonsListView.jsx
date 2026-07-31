import React from 'react';
import { useNavigate } from 'react-router-dom';

function statusLabel(status) {
  return status === 'collecting_availability' ? 'Collecting Availability' : 'Teams Generated';
}

function SeasonsListView({ seasons, loading }) {
  const navigate = useNavigate();

  return (
    <div className="panel seasons-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">All Seasons</h3>
        <button className="pill-btn pill-btn-blue" onClick={() => navigate('create')}>
          Create Season
        </button>
      </div>

      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : seasons.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No seasons yet</p>
          <p className="empty-state-subtitle">Create one to start collecting player availability.</p>
        </div>
      ) : (
        <div className="season-list">
          {seasons.map((s) => (
            <div className="season-row" key={s.id}>
              <div>
                <span className="season-row-name">{s.name}</span>
                <span className="season-row-meta">
                  {s.leagueName} &middot; {s.numTeams} teams
                </span>
              </div>
              <span className={`badge badge-count season-status-${s.status}`}>{statusLabel(s.status)}</span>
              {s.status === 'collecting_availability' ? (
                <button
                  className="outline-btn"
                  onClick={() => navigate(`${s.id}/availability`)}
                >
                  Review Availability
                </button>
              ) : (
                <button className="outline-btn" onClick={() => navigate('/league/standings')}>
                  View Standings
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SeasonsListView;
