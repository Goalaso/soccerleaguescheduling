import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PLAYERS_PER_TEAM_CHOICES = [6, 8, 10, 12];

function parseTeamNames(raw) {
  return raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

function CreateSeasonView({ leagues, createSeason }) {
  const navigate = useNavigate();
  const { user, updatePreferences } = useAuth();
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? '');
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  // Saved server-side (users.default_team_names), not localStorage — an
  // admin's default should follow their account across devices/browsers,
  // not disappear the first time local storage gets cleared.
  const [teamNamesInput, setTeamNamesInput] = useState(() => (user?.defaultTeamNames || []).join(', '));
  const [playersPerTeam, setPlayersPerTeam] = useState(10);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedDefault, setSavedDefault] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  const teamNames = parseTeamNames(teamNamesInput);

  const handleSaveDefault = async () => {
    setSavingDefault(true);
    try {
      await updatePreferences({ defaultTeamNames: teamNames });
      setSavedDefault(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDefault(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (teamNames.length === 0) {
      setError('Enter at least one team name.');
      return;
    }
    setSubmitting(true);
    try {
      const season = await createSeason({
        leagueId: Number(leagueId),
        teamNames,
        playersPerTeam,
        name: name || undefined,
        startsOn: startsOn || undefined,
      });
      navigate(`/seasons/${season.id}/availability`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel options-panel">
      <h3 className="panel-title">Create Season</h3>
      <form onSubmit={handleSubmit}>
        <div className="option-group">
          <span className="option-label">League</span>
          <div className="toggle-pair">
            {leagues.map((league) => (
              <button
                type="button"
                key={league.id}
                className={`toggle-btn ${Number(leagueId) === league.id ? 'active' : ''}`}
                onClick={() => setLeagueId(league.id)}
              >
                {league.name}
              </button>
            ))}
          </div>
        </div>

        <div className="option-group">
          <span className="option-label">Season Name</span>
          <input
            className="select-input"
            placeholder="e.g. Winter 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="option-group">
          <span className="option-label">Start Date</span>
          <input
            className="select-input"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>

        <div className="option-group">
          <span className="option-label">Team Names (comma separated)</span>
          <div className="team-names-input-row">
            <input
              className="select-input"
              placeholder="e.g. Panthers, Wolves, Eagles, Hawks"
              value={teamNamesInput}
              onChange={(e) => {
                setTeamNamesInput(e.target.value);
                setSavedDefault(false);
              }}
            />
            <button type="button" className="outline-btn" onClick={handleSaveDefault} disabled={savingDefault}>
              {savingDefault ? 'Saving...' : savedDefault ? 'Saved!' : 'Save as Default'}
            </button>
          </div>
          {teamNames.length > 0 && (
            <p className="empty-state-subtitle">
              {teamNames.length} team{teamNames.length === 1 ? '' : 's'}: {teamNames.join(', ')}
            </p>
          )}
        </div>

        <div className="option-group">
          <span className="option-label">Players per Team</span>
          <select
            className="select-input"
            value={playersPerTeam}
            onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
          >
            {PLAYERS_PER_TEAM_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </div>

        {error && <p className="options-warning">{error}</p>}

        <button className="pill-btn pill-btn-blue full-width" disabled={submitting || !leagueId}>
          {submitting ? 'Creating...' : 'Create Season & Ask Players'}
        </button>
      </form>
    </div>
  );
}

export default CreateSeasonView;
