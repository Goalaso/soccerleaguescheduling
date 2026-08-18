import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmPasswordModal from '../ConfirmPasswordModal';
import { useSelectedSeason } from '../../context/SelectedSeasonContext';

function statusLabel(status) {
  return status === 'collecting_availability' ? 'Collecting Availability' : 'Teams Generated';
}

function SeasonsListView({ seasons, loading, deleteSeason }) {
  const navigate = useNavigate();
  const { setSelectedLeagueId, setSelectedSeasonId } = useSelectedSeason();
  const [pendingDelete, setPendingDelete] = useState(null);

  const handleConfirmDelete = async (password) => {
    await deleteSeason(pendingDelete.id, password);
    setPendingDelete(null);
  };

  // /league/standings always reflects whatever SelectedSeasonContext
  // currently has selected, not anything encoded in the URL — so getting to
  // *this* season's standings means selecting it first, then navigating.
  const handleViewStandings = (season) => {
    setSelectedLeagueId(season.leagueId);
    setSelectedSeasonId(season.id);
    navigate('/league/standings');
  };

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
                <button className="outline-btn" onClick={() => handleViewStandings(s)}>
                  View Standings
                </button>
              )}
              <button
                type="button"
                className="link-btn link-btn-danger"
                onClick={() => setPendingDelete(s)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmPasswordModal
          title="Delete Season"
          description={`This permanently deletes "${pendingDelete.name}" and all of its teams, matches, and results. This cannot be undone.`}
          confirmLabel="Delete Season"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default SeasonsListView;
