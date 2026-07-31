import React from 'react';

function EmptyTeamsState() {
  return (
    <div className="panel empty-state">
      <div className="empty-state-icon">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
          <circle cx="9" cy="8" r="3" stroke="#7c8aa5" strokeWidth="1.5" />
          <circle cx="16" cy="9" r="2.5" stroke="#7c8aa5" strokeWidth="1.5" />
          <path
            d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.6-1.1-4.9-2.8-6.4A5 5 0 0121 19.5"
            stroke="#7c8aa5"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="empty-state-title">No teams generated yet</p>
      <p className="empty-state-subtitle">
        Adjust your options and click "Generate Teams" to create balanced
        teams.
      </p>
    </div>
  );
}

export default EmptyTeamsState;
