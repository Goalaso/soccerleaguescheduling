import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';

function formatRespondedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function AvailabilityReviewView({ onTeamsGenerated }) {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const { season } = useSeason(seasonId);
  const { players, loading, setAvailability } = useSeasonAvailability(seasonId);

  const availableCount = players.filter((p) => p.isAvailable).length;

  // First-come-first-served order: everyone who's actually responded,
  // earliest first — spans confirmed/waitlisted/declined, not just
  // waitlisted, so it's possible to see exactly how close a waitlist call
  // was (e.g. #40 confirmed vs #41 waitlisted, two minutes apart) rather
  // than just that it happened. Not-yet-responded players have no place in
  // this order, so they sort after everyone who has, in the backend's
  // default alphabetical order.
  const responded = [...players]
    .filter((p) => p.respondedAt)
    .sort((a, b) => new Date(a.respondedAt) - new Date(b.respondedAt));
  const orderByPlayer = Object.fromEntries(responded.map((p, i) => [p.playerId, i + 1]));
  const sortedPlayers = [...responded, ...players.filter((p) => !p.respondedAt)];

  // Waitlist-only position (e.g. "#3 on the waitlist") — same as before,
  // kept alongside the new overall response order above, not replaced by it.
  const waitlistPositionByPlayer = Object.fromEntries(
    players
      .filter((p) => p.waitlisted)
      .sort((a, b) => new Date(a.respondedAt) - new Date(b.respondedAt))
      .map((p, i) => [p.playerId, i + 1])
  );

  return (
    <div className="panel players-panel availability-panel">
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
          <div className="player-table-row availability-review-row player-table-head">
            <span>#</span>
            <span>Player</span>
            <span>Position</span>
            <span>Skill</span>
            <span>Responded</span>
            <span>Available</span>
          </div>
          <div className="player-table-body">
            {sortedPlayers.map((p) => (
              <div className="player-table-row availability-review-row" key={p.playerId}>
                <span className="option-label">{orderByPlayer[p.playerId] || '—'}</span>
                <span className="player-name">{p.name}</span>
                <span>{p.position}</span>
                <span>{p.skill}</span>
                <span>{formatRespondedAt(p.respondedAt)}</span>
                <span>
                  <button
                    type="button"
                    className={`availability-check ${p.isAvailable ? 'availability-check-yes' : ''}`}
                    onClick={() => setAvailability(p.playerId, !p.isAvailable)}
                    title={p.isAvailable ? 'Available — click to unmark' : 'Not confirmed — click to mark available'}
                  >
                    {p.isAvailable ? '✓' : ''}
                  </button>
                  {p.waitlisted && (
                    <span className="badge badge-count" style={{ marginLeft: '0.5rem' }}>
                      Waitlisted (#{waitlistPositionByPlayer[p.playerId]})
                    </span>
                  )}
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
