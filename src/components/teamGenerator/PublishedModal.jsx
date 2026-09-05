import React from 'react';
import Modal from '../Modal';

function PublishedModal({ teamCount, playerCount, avgSkill, balanceLabel, onBackToHome }) {
  return (
    <Modal onClose={onBackToHome}>
      <span className="modal-status-badge status-published">● Published</span>
      <h3 className="modal-title">Teams Published Successfully</h3>
      <p className="modal-description">
        {teamCount} balanced teams for Monday Night League have been saved and
        are now visible to all registered players.
      </p>

      <div className="modal-stat-grid">
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{teamCount}</span>
          <span className="modal-stat-label">Teams</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{playerCount}</span>
          <span className="modal-stat-label">Players</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value">{avgSkill}</span>
          <span className="modal-stat-label">Avg Skill</span>
        </div>
        <div className="modal-stat-tile">
          <span className="modal-stat-value modal-stat-value-green">
            {balanceLabel}
          </span>
          <span className="modal-stat-label">Balance</span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="pill-btn pill-btn-blue full-width" onClick={onBackToHome}>
          Back to Home
        </button>
      </div>
    </Modal>
  );
}

export default PublishedModal;
