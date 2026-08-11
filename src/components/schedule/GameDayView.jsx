import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../../hooks/useMatch';
import { useAuth } from '../../context/AuthContext';
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

// Every regular roster member always gets a row (so a captain can see and
// toggle the whole team, not just whoever's already confirmed), plus any
// sub/borrowed player an admin has already added to this specific match.
function buildRosterRows(fullRoster, matchPlayers) {
  const confirmedIds = new Set(matchPlayers.map((p) => p.id));
  const fullIds = new Set((fullRoster || []).map((p) => p.id));

  const regularRows = (fullRoster || []).map((p) => ({
    ...p,
    source: 'regular',
    confirmed: confirmedIds.has(p.id),
  }));

  const guestRows = matchPlayers
    .filter((p) => p.source !== 'regular' && !fullIds.has(p.id))
    .map((p) => ({ ...p, confirmed: true }));

  return [...regularRows, ...guestRows];
}

function RosterColumn({ team, fullRoster, isMyTeam, scorers, editable, onToggle, toggling }) {
  const goalsByPlayer = (scorers || [])
    .filter((s) => s.teamId === team.id)
    .reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {});

  const rows = buildRosterRows(fullRoster, team.players);
  const confirmedCount = rows.filter((r) => r.confirmed).length;

  return (
    <div className="panel record-roster-column">
      <div className="record-roster-header">
        <span>
          {shortName(team.name).toUpperCase()} — PLAYERS
          {isMyTeam && <span className="badge badge-count gameday-mine-badge">Your Team</span>}
        </span>
        {editable && (
          <span className="badge badge-count">
            {confirmedCount} of {rows.length} confirmed
          </span>
        )}
      </div>
      {rows.map((p) => {
        const goals = goalsByPlayer[p.id];
        return (
          <div
            className={`record-player-row record-player-row-readonly ${goals ? 'record-player-row-active' : ''} ${
              !p.confirmed ? 'record-player-row-unconfirmed' : ''
            }`}
            key={p.id}
          >
            {editable ? (
              <input
                type="checkbox"
                className="attendance-checkbox"
                checked={p.confirmed}
                disabled={toggling}
                onChange={() => onToggle(p.id, p.confirmed)}
                aria-label={`${p.name} attending`}
              />
            ) : (
              <span className={`gameday-attendance-dot ${p.confirmed ? '' : 'gameday-attendance-dot-out'}`} />
            )}
            <span className="record-player-name">{p.name}</span>
            <span className="record-player-position">{POSITION_ABBR[p.position]}</span>
            <span className="roster-source-badge">{p.source !== 'regular' ? p.source.toUpperCase() : ''}</span>
            <span className="gameday-goals">{goals ? `${goals} ⚽` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function GameDayView({ myTeamId, teams }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { match, loading, addToRoster, removeFromRoster } = useMatch(id);
  const [toggling, setToggling] = useState(false);

  if (loading || !match) {
    return <p className="auth-loading">Loading...</p>;
  }

  const played = match.status === 'played';
  const captainOfTeamIds = user?.captainOfTeamIds || [];

  const handleToggle = async (teamId, playerId, confirmed) => {
    setToggling(true);
    try {
      if (confirmed) {
        await removeFromRoster(playerId, teamId);
      } else {
        await addToRoster(playerId, teamId, 'regular');
      }
    } finally {
      setToggling(false);
    }
  };

  const homeFullRoster = teams?.find((t) => t.id === match.home.id)?.players;
  const awayFullRoster = teams?.find((t) => t.id === match.away.id)?.players;

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
        <RosterColumn
          team={match.home}
          fullRoster={homeFullRoster}
          isMyTeam={match.home.id === myTeamId}
          scorers={match.scorers}
          editable={!played && captainOfTeamIds.includes(match.home.id)}
          onToggle={(playerId, confirmed) => handleToggle(match.home.id, playerId, confirmed)}
          toggling={toggling}
        />
        <RosterColumn
          team={match.away}
          fullRoster={awayFullRoster}
          isMyTeam={match.away.id === myTeamId}
          scorers={match.scorers}
          editable={!played && captainOfTeamIds.includes(match.away.id)}
          onToggle={(playerId, confirmed) => handleToggle(match.away.id, playerId, confirmed)}
          toggling={toggling}
        />
      </div>
    </div>
  );
}

export default GameDayView;
