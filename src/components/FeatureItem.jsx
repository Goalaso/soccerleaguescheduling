import React from 'react';

function FeatureItem({ icon, title, description, onClick }) {
  return (
    <button className="feature-item" onClick={onClick}>
      <span className="feature-icon">{icon}</span>
      <span className="feature-text">
        <span className="feature-title">
          {title} <span className="feature-arrow">&gt;</span>
        </span>
        <span className="feature-description">{description}</span>
      </span>
    </button>
  );
}

export default FeatureItem;
