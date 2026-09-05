import React from 'react';

// Shared "N unconfirmed changes" bar + confirm button for every page using
// the local-stage-then-batch pattern (see usePendingChanges). Reuses the
// same panel/badge/pill-btn visual language as the rest of the app instead
// of inventing new styling. Renders nothing when there's nothing staged, so
// an untouched page looks exactly as it did before this pattern existed.
function PendingChangesBanner({ count, onConfirm, confirming, error, label = 'Confirm changes' }) {
  if (!count) return null;

  return (
    <div className="pending-changes-banner">
      <span className="badge badge-count">{count} unconfirmed change{count === 1 ? '' : 's'}</span>
      {error && <span className="pending-changes-error">{error}</span>}
      <button
        type="button"
        className="pill-btn pill-btn-blue notify-send-btn"
        disabled={confirming}
        onClick={onConfirm}
      >
        {confirming ? 'Sending…' : label}
      </button>
    </div>
  );
}

export default PendingChangesBanner;
