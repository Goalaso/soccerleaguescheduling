import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';

function AvailabilityReviewView({ onTeamsGenerated }) {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const { season } = useSeason(seasonId);
  const { players, loading, setAvailability } = useSeasonAvailability(seasonId);

  const availableCount = players.filter((p) => p.isAvailable).length;

  return (
    <div className="panel players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">
          Availability &mdash; {season?.name} ({season?.leagueName})
        </h3>
        <button
          className="pill-btn pill-btn-blue"
          onClick={() => navigate(`/seasons/${seasonId}/generate`)}
        >
          Generate Teams ({availableCount} available)
        </button>
      </div>

      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : (
        <div className="player-table">
          <div className="player-table-row player-table-head">
            <span>Player</span>
            <span>Position</span>
            <span>Skill</span>
            <span>Available</span>
          </div>
          <div className="player-table-body">
            {players.map((p) => (
              <div className="player-table-row" key={p.playerId}>
                <span className="player-name">{p.name}</span>
                <span>{p.position}</span>
                <span>{p.skill}</span>
                <span>
                  <button
                    type="button"
                    className={`availability-check ${p.isAvailable ? 'availability-check-yes' : ''}`}
                    onClick={() => setAvailability(p.playerId, !p.isAvailable)}
                    title={p.isAvailable ? 'Available — click to unmark' : 'Not confirmed — click to mark available'}
                  >
                    {p.isAvailable ? '✓' : ''}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailabilityReviewView;
