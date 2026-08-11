import React, { useState } from 'react';
import Modal from './Modal';

// Reused by every password-gated destructive action (delete season, delete
// player, delete own account) — the caller owns the actual API call and any
// follow-up (closing the modal, navigating, invalidating queries) inside
// onConfirm; this component only owns the password field and error display.
function ConfirmPasswordModal({ title, description, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{title}</h3>
      {description && <p className="modal-description">{description}</p>}
      <div className="option-group">
        <span className="option-label">Password</span>
        <input
          className="select-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </div>
      {error && <p className="options-warning">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="outline-btn" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          className="pill-btn pill-btn-blue"
          onClick={handleConfirm}
          disabled={submitting || !password}
        >
          {submitting ? 'Please wait...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmPasswordModal;
