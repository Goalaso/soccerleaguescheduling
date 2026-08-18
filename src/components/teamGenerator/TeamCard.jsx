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

function TeamCard({ team, editing, otherTeams, onMove, onRemove, onRename }) {
  return (
    <div className="team-card-v2" style={{ '--team-color': team.color }}>
      <div className="team-card-header">
        {editing ? (
          <input
            className="select-input team-name-input"
            value={team.name}
            onChange={(e) => onRename(e.target.value)}
            aria-label="Team name"
          />
        ) : (
          <h4>{team.name}</h4>
        )}
        <span className="team-avg-badge">Avg {team.avgSkill}</span>
      </div>

      <div className="team-stat-row">
        <div className="team-stat">
          <span className="team-stat-value">{team.counts.Forward}</span>
          <span className="team-stat-label">FWD</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{team.counts.Midfielder}</span>
          <span className="team-stat-label">MID</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{team.counts.defGk}</span>
          <span className="team-stat-label">DEF/GK</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{team.players.length}</span>
          <span className="team-stat-label">Total</span>
        </div>
      </div>

      <div className="team-player-list">
        {team.players.map((p) => (
          <div className="team-player-row" key={p.id}>
            <span className="player-name">{p.name}</span>
            <span className={`badge ${POSITION_CLASS[p.position]}`}>
              {p.position}
            </span>
            {editing ? (
              <div className="team-player-edit-actions">
                <select
                  className="select-input"
                  value=""
                  onChange={(e) => e.target.value && onMove(p.id, Number(e.target.value))}
                >
                  <option value="">Move to...</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="link-btn link-btn-danger" onClick={() => onRemove(p.id)}>
                  ✕
                </button>
              </div>
            ) : (
              <span className="skill-cell">
                <span className="skill-number">{p.skill}</span>
                <span className="skill-bar-track">
                  <span
                    className={`skill-bar-fill ${skillBarClass(p.skill)}`}
                    style={{ width: `${p.skill * 10}%` }}
                  />
                </span>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="team-balance-row">
        <span>Balance</span>
        <span className="skill-bar-track balance-track">
          <span
            className="skill-bar-fill balance-fill"
            style={{ width: `${team.avgSkill * 10}%` }}
          />
        </span>
        <span>{team.avgSkill}/10</span>
      </div>
    </div>
  );
}

export default TeamCard;
