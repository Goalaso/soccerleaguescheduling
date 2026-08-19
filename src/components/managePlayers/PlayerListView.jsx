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

function PlayerListView({ players, loading, deletePlayer }) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const { entries: waitlistEntries } = useWaitlist();
  const waitlistCount = waitlistEntries.length;

  const handleConfirmDelete = async (password) => {
    await deletePlayer(pendingDelete.id, password);
    setPendingDelete(null);
  };

  return (
    <div className="panel players-panel manage-players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Manage Players ({players.length})</h3>
        <div className="league-breadcrumb-actions">
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
                  <button
                    type="button"
                    className="link-btn link-btn-danger"
                    onClick={() => setPendingDelete(p)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
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
