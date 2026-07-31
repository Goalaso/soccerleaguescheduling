import React from 'react';
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

function RosterColumn({ team, isMyTeam, scorers }) {
  const goalsByPlayer = (scorers || [])
    .filter((s) => s.teamId === team.id)
    .reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {});

  return (
    <div className="panel record-roster-column">
      <div className="record-roster-header">
        <span>
          {shortName(team.name).toUpperCase()} — PLAYERS
          {isMyTeam && <span className="badge badge-count gameday-mine-badge">Your Team</span>}
        </span>
      </div>
      {team.players.map((p, i) => {
        const goals = goalsByPlayer[p.id];
        return (
          <div
            className={`record-player-row record-player-row-readonly ${goals ? 'record-player-row-active' : ''}`}
            key={p.id}
          >
            <span className="record-player-number">{i + 1}</span>
            <span className="record-player-name">{p.name}</span>
            <span className="record-player-position">{POSITION_ABBR[p.position]}</span>
            <span className="gameday-goals">{goals ? `${goals} ⚽` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function GameDayView({ myTeamId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { match, loading } = useMatch(id);

  if (loading || !match) {
    return <p className="auth-loading">Loading...</p>;
  }

  const played = match.status === 'played';

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={() => navigate('/schedule')}>
          &lt; Calendar
        </button>
        <span className="notify-breadcrumb-title">Gameday</span>
        <span className="generated-subtitle">Mon · {fullDate(new Date(match.matchDate))}</span>
      </div>

      <div className="panel record-score-header">
        <span className="record-score-team">{match.home.name}</span>
        {played ? (
          <div className="record-score-boxes">
            <span className="record-score-box">{match.homeGoals}</span>
            <span>:</span>
            <span className="record-score-box">{match.awayGoals}</span>
          </div>
        ) : (
          <span className="badge badge-count">Scheduled</span>
        )}
        <span className="record-score-team record-score-team-right">{match.away.name}</span>
      </div>

      <div className="record-roster-grid">
        <RosterColumn team={match.home} isMyTeam={match.home.id === myTeamId} scorers={match.scorers} />
        <RosterColumn team={match.away} isMyTeam={match.away.id === myTeamId} scorers={match.scorers} />
      </div>
    </div>
  );
}

export default GameDayView;
