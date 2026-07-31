import React from 'react';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

function RosterTable({ players, playerGoals }) {
  return (
    <div className="panel players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Roster</h3>
        <span className="generated-subtitle">{players.length} players</span>
      </div>

      <div className="player-table">
        <div className="player-table-row player-table-head roster-table-row">
          <span>Player</span>
          <span>Position</span>
          <span>Skill</span>
          <span>Goals</span>
          <span>Age</span>
        </div>
        <div className="player-table-body">
          {players.map((p) => (
            <div className="player-table-row roster-table-row" key={p.id}>
              <span className="player-name">{p.name}</span>
              <span>
                <span className={`badge ${POSITION_CLASS[p.position]}`}>
                  {p.position}
                </span>
              </span>
              <span>{p.skill}</span>
              <span>{playerGoals[p.id] || 0}</span>
              <span>{p.age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RosterTable;
