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

// Same team-card-v2 shape as a real team's column, sitting alongside them in
// the same grid — a neutral border color instead of a team color, and every
// row keeps its position badge + skill bar visible *while* picking a team
// to add to, since knowing what kind of player you're adding is the whole
// point of this column existing.
function UnassignedTeamCard({ players, teams, onAddPlayer }) {
  return (
    <div className="team-card-v2 unassigned-team-card" style={{ '--team-color': 'var(--text-faint)' }}>
      <div className="team-card-header">
        <h4>Unassigned</h4>
        <span className="team-avg-badge">{players.length}</span>
      </div>

      {players.length === 0 ? (
        <p className="empty-state-subtitle">Every eligible player is on a team.</p>
      ) : (
        <div className="team-player-list">
          {players.map((p) => (
            <div className="unassigned-player-row" key={p.id}>
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
              <select
                className="select-input"
                value=""
                onChange={(e) => e.target.value && onAddPlayer(p.id, Number(e.target.value))}
              >
                <option value="">Add to...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UnassignedTeamCard;
