import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWaitlist } from '../../hooks/useWaitlist';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function WaitlistView() {
  const navigate = useNavigate();
  const { entries, loading, dismiss } = useWaitlist();

  return (
    <div className="panel players-panel manage-players-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Waitlist ({entries.length})</h3>
        <button className="link-btn" onClick={() => navigate('/players')}>
          &lt; Manage Players
        </button>
      </div>

      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state-subtitle">No pending waitlist entries.</p>
      ) : (
        <div className="player-table">
          <div className="player-table-row player-manage-row player-table-head">
            <span>Email</span>
            <span>Message</span>
            <span>Received</span>
            <span />
            <span />
          </div>
          <div className="player-table-body">
            {entries.map((entry) => (
              <div className="player-table-row player-manage-row" key={entry.id}>
                <span className="player-name">{entry.email}</span>
                <span>
                  {entry.rawSubject && <strong>{entry.rawSubject}</strong>}
                  {entry.rawSubject && entry.rawSnippet && ' — '}
                  {entry.rawSnippet}
                  {!entry.rawSubject && !entry.rawSnippet && '—'}
                  {!entry.seasonOpen && (
                    <span className="badge badge-count" style={{ marginLeft: '0.5rem' }}>
                      No season open
                    </span>
                  )}
                </span>
                <span>{formatDate(entry.receivedAt)}</span>
                <span className="player-manage-actions">
                  <button
                    className="link-btn"
                    onClick={() =>
                      navigate(`/players/add?email=${encodeURIComponent(entry.email)}&waitlistId=${entry.id}`, {
                        state: { waitlistEntry: entry },
                      })
                    }
                  >
                    Add Player
                  </button>
                </span>
                <span className="player-manage-actions">
                  <button type="button" className="link-btn link-btn-danger" onClick={() => dismiss(entry.id)}>
                    Dismiss
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

export default WaitlistView;
