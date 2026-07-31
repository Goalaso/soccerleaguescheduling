import React from 'react';

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-svg" fill="none">
      <path
        d="M7 4h10v4a5 5 0 01-10 0V4z"
        stroke="#3d5afe"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4v1a4 4 0 004 4M17 5h3v1a4 4 0 01-4 4"
        stroke="#3d5afe"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 13v3m-3 4h6m-5 0v-4h4v4"
        stroke="#3d5afe"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default TrophyIcon;
