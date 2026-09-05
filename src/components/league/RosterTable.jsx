import React, { useState } from 'react';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

function RosterTable({ players, playerGoals }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (field) => {
    if (field !== sortField) return null;
    return <span className="player-table-sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const query = search.trim().toLowerCase();
  const withGoals = players.map((p) => ({ ...p, goals: playerGoals[p.id] || 0 }));
  const visiblePlayers = withGoals.filter((p) => {
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.position.toLowerCase().includes(query);
  });

  const sortedPlayers = [...visiblePlayers].sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    const result = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDirection === 'asc' ? result : -result;
  });

  return (
    <div className="panel players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Roster</h3>
        <div className="roster-table-header-actions">
          <input
            type="text"
            className="search-input"
            placeholder="Search roster..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="generated-subtitle">{players.length} players</span>
        </div>
      </div>

      <div className="player-table">
        <div className="player-table-row player-table-head roster-table-row">
          <button type="button" className="player-table-sort-btn" onClick={() => handleSort('name')}>
            Player {sortIndicator('name')}
          </button>
          <button type="button" className="player-table-sort-btn" onClick={() => handleSort('position')}>
            Position {sortIndicator('position')}
          </button>
          <button type="button" className="player-table-sort-btn" onClick={() => handleSort('skill')}>
            Skill {sortIndicator('skill')}
          </button>
          <button type="button" className="player-table-sort-btn" onClick={() => handleSort('goals')}>
            Goals {sortIndicator('goals')}
          </button>
          <button type="button" className="player-table-sort-btn" onClick={() => handleSort('age')}>
            Age {sortIndicator('age')}
          </button>
        </div>
        <div className="player-table-body">
          {sortedPlayers.length === 0 ? (
            <p className="empty-state-subtitle">No players match "{search}".</p>
          ) : (
            sortedPlayers.map((p) => (
              <div className="player-table-row roster-table-row" key={p.id}>
                <span className="player-name">{p.name}</span>
                <span>
                  <span className={`badge ${POSITION_CLASS[p.position]}`}>
                    {p.position}
                  </span>
                </span>
                <span>{p.skill}</span>
                <span>{p.goals}</span>
                <span>{p.age}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default RosterTable;
