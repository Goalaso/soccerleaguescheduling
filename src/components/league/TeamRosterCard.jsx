import React from 'react';
import { summarizeTeam } from '../../utils/generateTeams';

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

// Same team-card-v2 look as the team generator's TeamCard, adapted for a
// permanent, already-published team: no rename (that's not a wired-up
// action here), always in "editing" layout since this whole page exists to
// move/remove players — there's no separate view mode to toggle out of.
function TeamRosterCard({ team, otherTeams, busy, onMove, onRemove }) {
  const summarized = summarizeTeam(team);

  return (
    <div className="team-card-v2" style={{ '--team-color': team.color }}>
      <div className="team-card-header">
        <h4>{team.name}</h4>
        <span className="team-avg-badge">Avg {summarized.avgSkill}</span>
      </div>

      <div className="team-stat-row">
        <div className="team-stat">
          <span className="team-stat-value">{summarized.counts.Forward}</span>
          <span className="team-stat-label">FWD</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{summarized.counts.Midfielder}</span>
          <span className="team-stat-label">MID</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{summarized.counts.defGk}</span>
          <span className="team-stat-label">DEF/GK</span>
        </div>
        <div className="team-stat">
          <span className="team-stat-value">{team.players.length}</span>
          <span className="team-stat-label">Total</span>
        </div>
      </div>

      <div className="team-player-list">
        {team.players.map((p) => (
          <div className="team-roster-row" key={p.id}>
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
            <div className="team-player-edit-actions">
              <select
                className="select-input"
                value=""
                disabled={busy}
                onChange={(e) => e.target.value && onMove(p.id, Number(e.target.value))}
              >
                <option value="">Move to...</option>
                {otherTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="button" className="link-btn link-btn-danger" disabled={busy} onClick={() => onRemove(p.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="team-balance-row">
        <span>Balance</span>
        <span className="skill-bar-track balance-track">
          <span className="skill-bar-fill balance-fill" style={{ width: `${summarized.avgSkill * 10}%` }} />
        </span>
        <span>{summarized.avgSkill}/10</span>
      </div>
    </div>
  );
}

export default TeamRosterCard;
