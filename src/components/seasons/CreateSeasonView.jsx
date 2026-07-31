import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TEAM_COUNT_CHOICES = [2, 4, 6, 8];
const PLAYERS_PER_TEAM_CHOICES = [6, 8, 10, 12];

function CreateSeasonView({ leagues, createSeason }) {
  const navigate = useNavigate();
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? '');
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [numTeams, setNumTeams] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(10);
  const [balanceBySkill, setBalanceBySkill] = useState(true);
  const [balanceByAge, setBalanceByAge] = useState(false);
  const [balanceByPosition, setBalanceByPosition] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const season = await createSeason({
        leagueId: Number(leagueId),
        numTeams,
        playersPerTeam,
        balanceBySkill,
        balanceByAge,
        balanceByPosition,
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
          <span className="option-label">Number of Teams</span>
          <select
            className="select-input"
            value={numTeams}
            onChange={(e) => setNumTeams(Number(e.target.value))}
          >
            {TEAM_COUNT_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n} teams
              </option>
            ))}
          </select>
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

        <div className="option-group">
          <span className="option-label">Balance Teams By</span>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={balanceBySkill}
              onChange={(e) => setBalanceBySkill(e.target.checked)}
            />
            <span>
              <span className="checkbox-title">Skill rating</span>
            </span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={balanceByAge}
              onChange={(e) => setBalanceByAge(e.target.checked)}
            />
            <span>
              <span className="checkbox-title">Age</span>
            </span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={balanceByPosition}
              onChange={(e) => setBalanceByPosition(e.target.checked)}
            />
            <span>
              <span className="checkbox-title">Preferred position</span>
            </span>
          </label>
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
