import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../../hooks/useMatch';
import { formatMatchDate } from '../../utils/season';

const POSITION_ABBR = {
  Goalkeeper: 'GK',
  Defender: 'DEF',
  Midfielder: 'MID',
  Forward: 'FWD',
};

function shortName(name) {
  return name.replace('Team ', '');
}

function fullDate(date) {
  return `${formatMatchDate(date)}, ${date.getFullYear()}`;
}

function RosterColumn({ team, goalsByPlayer, onChange }) {
  const total = team.players.reduce((sum, p) => sum + (goalsByPlayer[p.id] || 0), 0);

  return (
    <div className="panel record-roster-column">
      <div className="record-roster-header">
        <span>{shortName(team.name).toUpperCase()} — PLAYERS</span>
        <span className="badge badge-count">{total} goals</span>
      </div>
      <p className="record-roster-hint">Tap + to log a goal</p>
      {team.players.map((p, i) => {
        const count = goalsByPlayer[p.id] || 0;
        return (
          <div
            className={`record-player-row ${count > 0 ? 'record-player-row-active' : ''}`}
            key={p.id}
          >
            <span className="record-player-number">{i + 1}</span>
            <span className="record-player-name">{p.name}</span>
            <span className="record-player-position">{POSITION_ABBR[p.position]}</span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onChange(p.id, Math.max(0, count - 1))}
              disabled={count === 0}
            >
              &minus;
            </button>
            <span className="record-player-count">{count}</span>
            <button type="button" className="stepper-btn" onClick={() => onChange(p.id, count + 1)}>
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RecordResultsView({ matches, onResultsSaved }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { match, loading, submitResults } = useMatch(id);

  const [homeGoalsByPlayer, setHomeGoalsByPlayer] = useState({});
  const [awayGoalsByPlayer, setAwayGoalsByPlayer] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!match) return;
    const homeInit = {};
    const awayInit = {};
    (match.scorers || []).forEach((s) => {
      if (s.teamId === match.home.id) homeInit[s.playerId] = s.goals;
      if (s.teamId === match.away.id) awayInit[s.playerId] = s.goals;
    });
    setHomeGoalsByPlayer(homeInit);
    setAwayGoalsByPlayer(awayInit);
  }, [match]);

  if (loading || !match) {
    return <p className="auth-loading">Loading...</p>;
  }

  const homeTotal = Object.values(homeGoalsByPlayer).reduce((s, v) => s + v, 0);
  const awayTotal = Object.values(awayGoalsByPlayer).reduce((s, v) => s + v, 0);
  const canSubmit = homeTotal > 0 || awayTotal > 0 || match.status === 'played';

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const scorers = [
        ...Object.entries(homeGoalsByPlayer)
          .filter(([, g]) => g > 0)
          .map(([playerId, goals]) => ({ playerId: Number(playerId), teamId: match.home.id, goals })),
        ...Object.entries(awayGoalsByPlayer)
          .filter(([, g]) => g > 0)
          .map(([playerId, goals]) => ({ playerId: Number(playerId), teamId: match.away.id, goals })),
      ];
      const result = await submitResults({ homeGoals: homeTotal, awayGoals: awayTotal, scorers });
      setSaved(result);
      onResultsSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    const otherPending = (matches || []).filter((m) => m.id !== match.id && m.status === 'scheduled');

    return (
      <div className="record-success">
        <div className="modal-check-icon record-success-icon">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="record-success-grid">
          <div className="record-success-message">
            <h3 className="modal-title">Results Saved!</h3>
            <p className="generated-subtitle">
              {fullDate(new Date(match.matchDate))} · {shortName(match.home.name)} vs{' '}
              {shortName(match.away.name)}
            </p>

            {otherPending.length > 0 && (
              <div className="record-warning-box">
                <p>
                  {otherPending.length} game{otherPending.length > 1 ? 's' : ''} still need
                  {otherPending.length === 1 ? 's' : ''} a score
                </p>
                {otherPending.slice(0, 3).map((m) => (
                  <p key={m.id} className="record-warning-item">
                    Mon · {formatMatchDate(new Date(m.matchDate))} — {shortName(m.home.name)} vs{' '}
                    {shortName(m.away.name)}
                    <br />
                    <span className="generated-subtitle">Score has not been recorded yet.</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="panel record-success-score-box">
            <span className="option-label">Final Score</span>
            <div className="record-success-score-row">
              <div>
                <p className="player-name">{shortName(match.home.name)}</p>
                <p className="record-success-score-value">{saved.homeGoals}</p>
              </div>
              <div>
                <p className="player-name">{shortName(match.away.name)}</p>
                <p className="record-success-score-value">{saved.awayGoals}</p>
              </div>
            </div>
            <div className="record-success-scorers">
              <div>
                <span className="option-label">{shortName(match.home.name)} Scorers</span>
                {saved.scorers
                  .filter((s) => s.teamId === match.home.id)
                  .map((s) => (
                    <p key={s.playerId}>
                      {s.playerName} {'●'.repeat(s.goals)}
                    </p>
                  ))}
              </div>
              <div>
                <span className="option-label">{shortName(match.away.name)} Scorers</span>
                {saved.scorers
                  .filter((s) => s.teamId === match.away.id)
                  .map((s) => (
                    <p key={s.playerId}>
                      {s.playerName} {'●'.repeat(s.goals)}
                    </p>
                  ))}
              </div>
            </div>
          </div>

          <div className="record-success-actions">
            <button
              className="pill-btn pill-btn-blue full-width"
              onClick={() => navigate('/schedule')}
            >
              + Record Another Game
            </button>
            <button className="outline-btn full-width" onClick={() => navigate('/schedule')}>
              Back to Calendar
            </button>
            <button className="outline-btn full-width" onClick={() => navigate('/league/standings')}>
              View Standings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={() => navigate('/schedule')}>
          &lt; Calendar
        </button>
        <span className="notify-breadcrumb-title">Record Game Results</span>
        <span className="generated-subtitle">Mon · {fullDate(new Date(match.matchDate))}</span>
        <button
          className="pill-btn pill-btn-blue notify-send-btn"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Saving...' : 'Submit Results'}
        </button>
      </div>

      {error && <p className="options-warning">{error}</p>}

      <div className="panel record-score-header">
        <span className="record-score-team">{match.home.name}</span>
        <div className="record-score-boxes">
          <span className="record-score-box">{homeTotal || '—'}</span>
          <span>:</span>
          <span className="record-score-box">{awayTotal || '—'}</span>
        </div>
        <span className="record-score-team record-score-team-right">{match.away.name}</span>
      </div>

      <div className="record-roster-grid">
        <RosterColumn
          team={match.home}
          goalsByPlayer={homeGoalsByPlayer}
          onChange={(playerId, val) =>
            setHomeGoalsByPlayer((prev) => ({ ...prev, [playerId]: val }))
          }
        />
        <RosterColumn
          team={match.away}
          goalsByPlayer={awayGoalsByPlayer}
          onChange={(playerId, val) =>
            setAwayGoalsByPlayer((prev) => ({ ...prev, [playerId]: val }))
          }
        />
      </div>
    </div>
  );
}

export default RecordResultsView;
