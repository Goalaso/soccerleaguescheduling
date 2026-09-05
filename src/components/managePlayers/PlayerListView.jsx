import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmPasswordModal from '../ConfirmPasswordModal';
import { useWaitlist } from '../../hooks/useWaitlist';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

const SORT_ACCESSORS = {
  name: (p) => p.name,
  position: (p) => p.position,
  skill: (p) => p.skill,
  leagues: (p) => p.leagues.map((l) => l.name).join(', '),
};

function PlayerListView({ players, loading, deletePlayer, leagues }) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const { entries: waitlistEntries } = useWaitlist();
  const waitlistCount = waitlistEntries.length;

  const handleConfirmDelete = async (password) => {
    await deletePlayer(pendingDelete.id, password);
    setPendingDelete(null);
  };

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
  const visiblePlayers = players.filter((p) => {
    if (leagueFilter !== 'all' && !p.leagues.some((l) => String(l.id) === leagueFilter)) return false;
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.position.toLowerCase().includes(query) ||
      p.leagues.some((l) => l.name.toLowerCase().includes(query))
    );
  });

  const accessor = SORT_ACCESSORS[sortField];
  const sortedPlayers = [...visiblePlayers].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const result = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDirection === 'asc' ? result : -result;
  });

  const filterActive = leagueFilter !== 'all' || query;

  return (
    <div className="panel players-panel manage-players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">
          Manage Players ({filterActive ? `${sortedPlayers.length} of ${players.length}` : players.length})
        </h3>
        <div className="league-breadcrumb-actions">
          <select
            className="select-input player-league-filter"
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
          >
            <option value="all">All Leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="outline-btn" onClick={() => navigate('/players/waitlist')}>
            Waitlist{waitlistCount > 0 ? ` (${waitlistCount})` : ''}
          </button>
          <button className="pill-btn pill-btn-blue" onClick={() => navigate('/players/add')}>
            Add Player
          </button>
        </div>
      </div>

      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : (
        <div className="player-table">
          <div className="player-table-row player-manage-row player-table-head">
            <button type="button" className="player-table-sort-btn" onClick={() => handleSort('name')}>
              Player {sortIndicator('name')}
            </button>
            <button type="button" className="player-table-sort-btn" onClick={() => handleSort('position')}>
              Position {sortIndicator('position')}
            </button>
            <button type="button" className="player-table-sort-btn" onClick={() => handleSort('skill')}>
              Skill {sortIndicator('skill')}
            </button>
            <button type="button" className="player-table-sort-btn" onClick={() => handleSort('leagues')}>
              Leagues {sortIndicator('leagues')}
            </button>
            <span />
          </div>
          <div className="player-table-body">
            {sortedPlayers.length === 0 ? (
              <p className="empty-state-subtitle">
                {query ? `No players match "${search}".` : 'No players in this league.'}
              </p>
            ) : (
              sortedPlayers.map((p) => (
                <div className="player-table-row player-manage-row" key={p.id}>
                  <span className="player-name">{p.name}</span>
                  <span>
                    <span className={`badge ${POSITION_CLASS[p.position]}`}>{p.position}</span>
                  </span>
                  <span>{p.skill}</span>
                  <span>{p.leagues.map((l) => l.name).join(', ') || '—'}</span>
                  <span className="player-manage-actions">
                    <button className="link-btn" onClick={() => navigate(`/players/edit/${p.id}`)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link-btn link-btn-danger"
                      onClick={() => setPendingDelete(p)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmPasswordModal
          title="Delete Player"
          description={`This permanently removes ${pendingDelete.name} from the roster.`}
          confirmLabel="Delete Player"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default PlayerListView;
