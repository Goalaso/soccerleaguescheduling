import React from 'react';

const TEAM_COUNT_CHOICES = [2, 4, 6, 8];
const PLAYERS_PER_TEAM_CHOICES = [6, 8, 10, 12];

function GenerationOptions({ options, setOptions, playerCount, onGenerate, disabled, leagues, fixed, season }) {
  const needed = options.numTeams * options.playersPerTeam;
  const notEnoughPlayers = needed > playerCount;

  const update = (patch) => setOptions((prev) => ({ ...prev, ...patch }));

  return (
    <div className="panel options-panel">
      <h3 className="panel-title">Generation Options</h3>

      {fixed ? (
        <div className="option-group">
          <span className="option-label">Season</span>
          <p className="generated-subtitle">
            {season?.leagueName} &middot; {season?.numTeams} teams &middot; {season?.playersPerTeam} players/team
          </p>
          <p className="generated-subtitle">Decided when this season was created.</p>
        </div>
      ) : (
        <>
          <div className="option-group">
            <span className="option-label">League Type</span>
            <div className="toggle-pair">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  className={`toggle-btn ${options.leagueId === league.id ? 'active' : ''}`}
                  onClick={() => update({ leagueId: league.id })}
                >
                  {league.name}
                </button>
              ))}
            </div>
          </div>

          <div className="option-group">
            <span className="option-label">Number of Teams</span>
            <select
              className="select-input"
              value={options.numTeams}
              onChange={(e) => update({ numTeams: Number(e.target.value) })}
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
              value={options.playersPerTeam}
              onChange={(e) => update({ playersPerTeam: Number(e.target.value) })}
            >
              {PLAYERS_PER_TEAM_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="option-group">
        <span className="option-label">Balance Teams By</span>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.balanceBySkill}
            onChange={(e) => update({ balanceBySkill: e.target.checked })}
          />
          <span>
            <span className="checkbox-title">Skill rating</span>
            <span className="checkbox-description">
              Distribute players evenly by skill level across all teams
            </span>
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.balanceByAge}
            onChange={(e) => update({ balanceByAge: e.target.checked })}
          />
          <span>
            <span className="checkbox-title">Age</span>
            <span className="checkbox-description">
              Distribute players evenly by age across all teams
            </span>
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.balanceByPosition}
            onChange={(e) => update({ balanceByPosition: e.target.checked })}
          />
          <span>
            <span className="checkbox-title">Preferred position</span>
            <span className="checkbox-description">
              Ensure each team has a mix of forwards, midfielders, and defenders
            </span>
          </span>
        </label>
      </div>

      {notEnoughPlayers && (
        <p className="options-warning">
          Not enough players ({playerCount}) for {needed} spots. Generating with
          all available players.
        </p>
      )}

      <button
        className="pill-btn pill-btn-blue full-width"
        onClick={onGenerate}
        disabled={disabled}
      >
        {disabled ? 'Loading players...' : 'Generate Teams'}
      </button>
    </div>
  );
}

export default GenerationOptions;
