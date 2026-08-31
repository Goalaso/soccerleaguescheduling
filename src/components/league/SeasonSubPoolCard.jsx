import React from 'react';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

function skillBarClass(skill) {
  if (skill >= 7) return 'skill-bar-high';
  if (skill >= 5) return 'skill-bar-mid';
  return 'skill-bar-low';
}

// Same visual family as UnassignedTeamCard on the team generator — a
// neutral-bordered column sitting alongside the real team card — but a
// plain "Add" button instead of a team-picker dropdown, since there's only
// ever one destination on this page (whichever team is being edited).
function SeasonSubPoolCard({ players, busy, onAdd }) {
  return (
    <div className="team-card-v2 unassigned-team-card" style={{ '--team-color': 'var(--text-faint)' }}>
      <div className="team-card-header">
        <h4>Available to Add</h4>
        <span className="team-avg-badge">{players.length}</span>
      </div>

      {players.length === 0 ? (
        <p className="empty-state-subtitle">No unrostered players available for this season.</p>
      ) : (
        <div className="team-player-list">
          {players.map((p) => (
            <div className="unassigned-player-row" key={p.playerId}>
              <span className="player-name">{p.name}</span>
              <span className={`badge ${POSITION_CLASS[p.position]}`}>{p.position}</span>
              <span className="skill-cell">
                <span className="skill-number">{p.skill}</span>
                <span className="skill-bar-track">
                  <span
                    className={`skill-bar-fill ${skillBarClass(p.skill)}`}
                    style={{ width: `${p.skill * 10}%` }}
                  />
                </span>
              </span>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => onAdd(p.playerId)}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SeasonSubPoolCard;
