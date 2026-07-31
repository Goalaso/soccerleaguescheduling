import React from 'react';
import Modal from '../Modal';

function SentModal({ stats, onViewTeams, onBackToHome }) {
  return (
    <Modal onClose={onViewTeams}>
      <div className="modal-check-icon">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="modal-status-badge status-sent">● Sent</span>
      <h3 className="modal-title">Notifications Sent Successfully</h3>
      <p className="modal-description">
        All {stats.players} players have been notified of their team
        assignments for Monday Night League, Winter 2026.
      </p>

      <div className="modal-stat-grid">
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{stats.players}</span>
          <span className="modal-stat-label">Players</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{stats.teams}</span>
          <span className="modal-stat-label">Teams</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{stats.messages}</span>
          <span className="modal-stat-label">Messages</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value modal-stat-value-green">
            {stats.delivered}%
          </span>
          <span className="modal-stat-label">Delivered</span>
        </div>
      </div>

      <p className="modal-breakdown">
        ● Email · {stats.emailCount} sent &nbsp; ● SMS · {stats.smsCount} sent
        &nbsp; ● App Push · {stats.appCount > 0 ? `${stats.appCount} sent` : 'off'}
      </p>

      <div className="modal-actions">
        <button className="outline-btn" onClick={onViewTeams}>
          View Teams Page
        </button>
        <button className="pill-btn pill-btn-blue" onClick={onBackToHome}>
          Back to Home
        </button>
      </div>
    </Modal>
  );
}

export default SentModal;
