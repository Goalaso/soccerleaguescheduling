import React from 'react';

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
const POSITION_LABEL = {
  Goalkeeper: 'Goalkeeper',
  Defender: 'Defenders',
  Midfielder: 'Midfielders',
  Forward: 'Forwards',
};
const POSITION_COLOR = {
  Goalkeeper: '#f2994a',
  Defender: '#22c55e',
  Midfielder: '#3d5afe',
  Forward: '#ef4444',
};

function PositionBreakdownPanel({ players }) {
  const counts = POSITION_ORDER.map((position) => ({
    position,
    count: players.filter((p) => p.position === position).length,
  })).filter((g) => g.count > 0);

  return (
    <div className="panel sidebar-card">
      <h3 className="panel-title">Position Breakdown</h3>
      {counts.map((g) => (
        <div className="position-breakdown-row" key={g.position}>
          <span
            className="position-breakdown-swatch"
            style={{ background: POSITION_COLOR[g.position] }}
          />
          <span className="position-breakdown-label">
            {POSITION_LABEL[g.position]}
          </span>
          <span className="position-breakdown-count">{g.count}</span>
        </div>
      ))}
    </div>
  );
}

export default PositionBreakdownPanel;
