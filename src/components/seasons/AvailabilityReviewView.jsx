import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePendingChanges } from '../../hooks/usePendingChanges';
import PendingChangesBanner from '../shared/PendingChangesBanner';

function formatRespondedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function AvailabilityReviewView({ onTeamsGenerated }) {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const { season } = useSeason(seasonId);
  const { players, loading, setAvailabilityBatch } = useSeasonAvailability(seasonId);
  const pending = usePendingChanges();
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Capacity shown here (and what Generate Teams actually acts on) is real,
  // server-confirmed availability — deliberately not pending-aware, so this
  // count never implies a capacity that hasn't actually taken effect yet.
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
  // Stays server-derived, same reasoning as availableCount above — a staged
  // decline/confirm can shift who's promoted, but that only actually
  // happens once the batch is sent, so recomputing it live here would show
  // a position that isn't real yet.
  const waitlistPositionByPlayer = Object.fromEntries(
    players
      .filter((p) => p.waitlisted)
      .sort((a, b) => new Date(a.respondedAt) - new Date(b.respondedAt))
      .map((p, i) => [p.playerId, i + 1])
  );

  // Stages the toggle instead of sending it immediately — see
  // usePendingChanges. A second click on an already-pending row cancels
  // the pending change rather than advancing to a third state: isAvailable
  // is a nullable boolean (null = never responded, distinct from false =
  // declined), so a plain double-negation toggle can never round-trip back
  // to a null original — cancelling the pending entry directly is the only
  // way "click, then click again" reliably returns to exactly what the row
  // showed before, for every starting value including null.
  const handleToggle = (p) => {
    if (pending.get(p.playerId)) {
      pending.unstage(p.playerId);
    } else {
      pending.stage(p.playerId, { playerId: p.playerId, isAvailable: !p.isAvailable });
    }
  };

  const handleConfirm = async () => {
    setConfirmError(null);
    setConfirming(true);
    try {
      await setAvailabilityBatch(Array.from(pending.pending.values()));
      pending.clear();
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setConfirming(false);
    }
  };

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

      <PendingChangesBanner
        count={pending.count}
        onConfirm={handleConfirm}
        confirming={confirming}
        error={confirmError}
      />

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
            {sortedPlayers.map((p) => {
              const staged = pending.get(p.playerId);
              const effectiveAvailable = staged ? staged.isAvailable : p.isAvailable;
              return (
                <div className="player-table-row availability-review-row" key={p.playerId}>
                  <span className="option-label">{orderByPlayer[p.playerId] || '—'}</span>
                  <span className="player-name">{p.name}</span>
                  <span>{p.position}</span>
                  <span>{p.skill}</span>
                  <span>{formatRespondedAt(p.respondedAt)}</span>
                  <span className="availability-cell">
                    <button
                      type="button"
                      className={`availability-check ${effectiveAvailable ? 'availability-check-yes' : ''}`}
                      onClick={() => handleToggle(p)}
                      title={effectiveAvailable ? 'Available — click to unmark' : 'Not confirmed — click to mark available'}
                    >
                      {effectiveAvailable ? '✓' : ''}
                    </button>
                    {staged && <span className="badge badge-count">Pending</span>}
                    {p.waitlisted && (
                      <span className="badge badge-count">Waitlisted (#{waitlistPositionByPlayer[p.playerId]})</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailabilityReviewView;
