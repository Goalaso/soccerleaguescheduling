import React from 'react';
import { POSITIONS } from '../../constants/positions';

function skillBarClass(skill) {
  if (skill >= 7) return 'skill-bar-high';
  if (skill >= 5) return 'skill-bar-mid';
  return 'skill-bar-low';
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PlayerFormFields({ values, onChange, leagues, leagueIds, onToggleLeague }) {
  const fullName = `${values.firstName} ${values.lastName}`.trim();
  const leagueNames = leagues
    .filter((l) => leagueIds.includes(l.id))
    .map((l) => l.name)
    .join(', ');

  return (
    <div className="player-form-grid">
      <div className="panel">
        <h3 className="panel-title">Personal Information</h3>
        <div className="player-form-row">
          <div className="option-group">
            <span className="option-label">First Name</span>
            <input
              className="select-input"
              value={values.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="option-group">
            <span className="option-label">Last Name</span>
            <input
              className="select-input"
              value={values.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>
        <div className="option-group">
          <span className="option-label">Email Address</span>
          <input
            className="select-input"
            type="email"
            value={values.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="option-group">
          <span className="option-label">Phone Number</span>
          <input
            className="select-input"
            value={values.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="(555) 000-0000"
          />
        </div>
        <div className="player-form-row">
          <div className="option-group">
            <span className="option-label">Age</span>
            <input
              className="select-input"
              type="number"
              min={1}
              value={values.age}
              onChange={(e) => onChange('age', e.target.value)}
              placeholder="--"
            />
          </div>
          <div className="option-group">
            <span className="option-label">Gender</span>
            <select
              className="select-input"
              value={values.gender}
              onChange={(e) => onChange('gender', e.target.value)}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Soccer Information</h3>
        <div className="option-group">
          <span className="option-label">Preferred Position</span>
          <div className="toggle-grid">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`toggle-btn ${values.position === p ? 'active' : ''}`}
                onClick={() => onChange('position', p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="option-group">
          <span className="option-label">
            Skill Rating {values.skill ? `— ${values.skill}/10` : '— not set'}
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={values.skill || 1}
            onChange={(e) => onChange('skill', Number(e.target.value))}
            className="skill-slider"
            style={{ '--skill-fill': `${((values.skill || 1) - 1) * (100 / 9)}%` }}
          />
          <div className="skill-slider-ticks">
            <span>1 · Beginner</span>
            <span>5 · Intermediate</span>
            <span>10 · Elite</span>
          </div>
        </div>

        <div className="option-group">
          <span className="option-label">Preferred League</span>
          {leagues.map((league) => (
            <label className="checkbox-row" key={league.id}>
              <input
                type="checkbox"
                checked={leagueIds.includes(league.id)}
                onChange={() => onToggleLeague(league.id)}
              />
              <span>
                <span className="checkbox-title">{league.name}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="option-group">
          <span className="option-label">Years Playing</span>
          <input
            className="select-input"
            type="number"
            min={0}
            value={values.yearsExperience}
            onChange={(e) => onChange('yearsExperience', e.target.value)}
            placeholder="e.g. 5"
          />
        </div>
      </div>

      <div className="panel player-preview-panel">
        <h3 className="panel-title">Player Preview</h3>
        {fullName || values.position ? (
          <div className="player-preview-card">
            <span className="team-summary-avatar player-preview-avatar">
              {fullName ? initials(fullName) : '?'}
            </span>
            <p className="player-preview-name">{fullName || 'New Player'}</p>
            <p className="player-preview-sub">
              {values.position || 'Position'}
              {leagueNames ? ` · ${leagueNames}` : ''}
            </p>
            <div className="player-preview-stats">
              <div>
                <span className="team-summary-stat-value">{values.age || '--'}</span>
                <span className="team-summary-stat-label">Age</span>
              </div>
              <div>
                <span className="team-summary-stat-value">{values.yearsExperience || '--'}</span>
                <span className="team-summary-stat-label">Experience</span>
              </div>
            </div>
            <div className="skill-cell player-preview-skill">
              <span className="skill-bar-track">
                <span
                  className={`skill-bar-fill ${skillBarClass(values.skill || 0)}`}
                  style={{ width: `${(values.skill || 0) * 10}%` }}
                />
              </span>
              <span className="skill-number">{values.skill || 0}/10</span>
            </div>
          </div>
        ) : (
          <p className="empty-state-subtitle">
            No data entered yet. Fill in the form to see a preview.
          </p>
        )}
      </div>
    </div>
  );
}

export default PlayerFormFields;
