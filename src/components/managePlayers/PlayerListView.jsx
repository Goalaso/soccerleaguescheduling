import React from 'react';
import { useNavigate } from 'react-router-dom';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

function PlayerListView({ players, loading, deletePlayer }) {
  const navigate = useNavigate();

  const handleDelete = async (player) => {
    if (!window.confirm(`Remove ${player.name} from the roster?`)) return;
    await deletePlayer(player.id);
  };

  return (
    <div className="panel players-panel manage-players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Manage Players ({players.length})</h3>
        <button className="pill-btn pill-btn-blue" onClick={() => navigate('/players/add')}>
          Add Player
        </button>
      </div>

      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : (
        <div className="player-table">
          <div className="player-table-row player-manage-row player-table-head">
            <span>Player</span>
            <span>Position</span>
            <span>Skill</span>
            <span>Leagues</span>
            <span />
          </div>
          <div className="player-table-body">
            {players.map((p) => (
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
                  <button className="link-btn" onClick={() => handleDelete(p)}>
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerListView;
