import React from 'react';

function PlayerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" fill="none">
      <circle cx="9" cy="8" r="4" fill="#3d5afe" />
      <path
        d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7"
        stroke="#3d5afe"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M18 8h4M20 6v4" stroke="#3d5afe" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default PlayerIcon;
