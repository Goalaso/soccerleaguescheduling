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

function PlayerTable({ players, searchTerm, onSearchChange }) {
  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="panel players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Available Players ({players.length})</h3>
        <input
          className="search-input"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="player-table">
        <div className="player-table-row player-table-head">
          <span>Player</span>
          <span>Preferred Position</span>
          <span>Skill Rating</span>
          <span>Age</span>
        </div>
        <div className="player-table-body">
          {filtered.map((p) => (
            <div className="player-table-row" key={p.id}>
              <span className="player-name">{p.name}</span>
              <span>
                <span className={`badge ${POSITION_CLASS[p.position]}`}>
                  {p.position}
                </span>
              </span>
              <span className="skill-cell">
                <span className="skill-number">{p.skill}</span>
                <span className="skill-bar-track">
                  <span
                    className={`skill-bar-fill ${skillBarClass(p.skill)}`}
                    style={{ width: `${p.skill * 10}%` }}
                  />
                </span>
              </span>
              <span>{p.age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlayerTable;
