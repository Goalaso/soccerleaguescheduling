import React from 'react';

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
const POSITION_LABEL = {
  Goalkeeper: 'Goalkeeper',
  Defender: 'Defenders',
  Midfielder: 'Midfielders',
  Forward: 'Forwards',
};

function skillBarClass(skill) {
  if (skill >= 7) return 'skill-bar-high';
  if (skill >= 5) return 'skill-bar-mid';
  return 'skill-bar-low';
}

function SkillByPositionPanel({ players }) {
  const groups = POSITION_ORDER.map((position) => {
    const group = players.filter((p) => p.position === position);
    const avg = group.length
      ? group.reduce((sum, p) => sum + p.skill, 0) / group.length
      : 0;
    return { position, avg: Math.round(avg * 10) / 10 };
  }).filter((g) => g.avg > 0);

  return (
    <div className="panel sidebar-card">
      <h3 className="panel-title">Avg Skill by Position</h3>
      {groups.map((g) => (
        <div className="skill-by-position-row" key={g.position}>
          <span className="skill-by-position-label">
            {POSITION_LABEL[g.position]}
          </span>
          <span className="skill-bar-track skill-by-position-track">
            <span
              className={`skill-bar-fill ${skillBarClass(g.avg)}`}
              style={{ width: `${g.avg * 10}%` }}
            />
          </span>
          <span className="skill-by-position-value">{g.avg}</span>
        </div>
      ))}
    </div>
  );
}

export default SkillByPositionPanel;
