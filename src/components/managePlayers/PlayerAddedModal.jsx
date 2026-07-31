import React from 'react';
import Modal from '../Modal';

function initials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PlayerAddedModal({ player, onAddAnother, onBackToList }) {
  const leagueName = player.leagues?.[0]?.name;

  return (
    <Modal onClose={onBackToList}>
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
      <h3 className="modal-title">Player Added Successfully!</h3>
      <p className="modal-description">
        {player.name} has been added to the Monday Night League · Winter 2026 roster.
      </p>

      <div className="added-player-summary">
        <span className="team-summary-avatar">{initials(player.name)}</span>
        <span className="added-player-summary-text">
          <span className="player-name">{player.name}</span>
          <span className="added-player-meta">
            {player.position} · Skill {player.skill}/10{leagueName ? ` · ${leagueName}` : ''}
          </span>
        </span>
      </div>

      <div className="modal-actions">
        <button className="outline-btn" onClick={onBackToList}>
          Back to List
        </button>
        <button className="pill-btn pill-btn-blue" onClick={onAddAnother}>
          Add Another Player
        </button>
      </div>
    </Modal>
  );
}

export default PlayerAddedModal;
