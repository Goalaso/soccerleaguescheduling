import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../../hooks/useMatch';
import { usePendingChanges } from '../../hooks/usePendingChanges';
import { useAuth } from '../../context/AuthContext';
import { formatMatchDate, parseMatchDate, isMatchOverdue, attendanceTierClass } from '../../utils/season';
import PendingChangesBanner from '../shared/PendingChangesBanner';

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
//
// A season-roster player who isn't in this team's own match roster because
// they've been loaned out — whether to the opponent right here, or to a
// completely different match elsewhere this same round — isn't just
// "unconfirmed," they're not eligible to be checked in here at all. `team`
// carries a server-computed `loanedOut` map (playerId -> their current
// team's name) covering both cases, since the "different match entirely"
// case has no other trace in this match's own data at all.
// `pending` (a usePendingChanges instance, keyed `${playerId}:${teamId}`)
// layers staged-but-unsent attendance toggles on top of the server's real
// roster — `confirmed` stays the true server value (goal-stepper gating
// deliberately keeps reading that, not the staged value — see the plan's
// "two separate steps" decision), while `checked` is what the checkbox
// itself displays, pending-over-server.
function buildRosterRows(fullRoster, matchPlayers, team, pending) {
  // matchPlayers is the match's *effective* roster, which still includes a
  // fallback listing of the whole season roster before anyone's touched
  // this match at all — that fallback is there so the team is still visible
  // (e.g. to log a goal), not because everyone showed up. p.confirmed
  // distinguishes a real roll-call row from that fallback; only real rows
  // count as actually confirmed here.
  const confirmedIds = new Set(matchPlayers.filter((p) => p.confirmed).map((p) => p.id));
  const fullIds = new Set((fullRoster || []).map((p) => p.id));
  const loanedOut = team.loanedOut || {};

  const regularRows = (fullRoster || []).map((p) => {
    const confirmed = confirmedIds.has(p.id);
    const staged = pending?.get(`${p.id}:${team.id}`);
    return {
      ...p,
      source: 'regular',
      confirmed,
      checked: staged ? staged.action === 'add' : confirmed,
      loanedToTeamName: loanedOut[p.id] || null,
    };
  });

  const guestRows = matchPlayers
    .filter((p) => p.source !== 'regular' && !fullIds.has(p.id))
    .map((p) => ({ ...p, confirmed: true, checked: true, loanedToTeamName: null }));

  return [...regularRows, ...guestRows];
}

// mode: 'readonly' (opponent, or after the match is played) | 'attendance'
// (pre-game roll call — checkbox only) | 'scoring' (post-game, this
// viewer's own team — checkbox + goal steppers combined in one row, same
// shape as the admin's RecordResultsView roster rows).
function RosterColumn({ team, fullRoster, isMyTeam, scorers, mode, onToggle, pending, goalsByPlayer, onGoalChange }) {
  const recordedGoals = (scorers || [])
    .filter((s) => s.teamId === team.id)
    .reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {});

  const rows = buildRosterRows(fullRoster, team.players, team, pending);
  const confirmedCount = rows.filter((r) => r.confirmed).length;

  return (
    <div className="panel record-roster-column">
      <div className="record-roster-header">
        <span>
          {shortName(team.name).toUpperCase()} — PLAYERS
          {isMyTeam && <span className="badge badge-count gameday-mine-badge">Your Team</span>}
        </span>
        {mode !== 'readonly' && (
          <span className={`badge badge-count ${attendanceTierClass(confirmedCount)}`}>
            {confirmedCount} of {rows.length} confirmed
          </span>
        )}
      </div>
      {mode === 'scoring' && <p className="record-roster-hint">Check who played, tap + to log a goal</p>}
      {rows.map((p, i) => {
        if (mode === 'scoring') {
          const count = goalsByPlayer[p.id] || 0;
          return (
            <div className={`record-player-row ${count > 0 ? 'record-player-row-active' : ''}`} key={p.id}>
              <input
                type="checkbox"
                className="attendance-checkbox"
                checked={p.checked}
                disabled={!!p.loanedToTeamName}
                onChange={() => onToggle(p.id, p.checked)}
                aria-label={`${p.name} attending`}
              />
              <span className="record-player-name">
                {p.name}
                {p.loanedToTeamName && (
                  <span
                    className="roster-source-badge gameday-loaned-badge"
                    title={`LOANED TO ${p.loanedToTeamName.toUpperCase()}`}
                  >
                    LOANED TO {p.loanedToTeamName.toUpperCase()}
                  </span>
                )}
              </span>
              <span className="record-player-position">{POSITION_ABBR[p.position]}</span>
              <div className="record-goal-controls">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => onGoalChange(p.id, Math.max(0, count - 1))}
                  disabled={!p.confirmed || count === 0}
                >
                  &minus;
                </button>
                <span className="record-player-count">{count}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => onGoalChange(p.id, count + 1)}
                  disabled={!p.confirmed}
                >
                  +
                </button>
              </div>
            </div>
          );
        }

        const goals = recordedGoals[p.id];
        const badgeText = p.loanedToTeamName
          ? `LOANED TO ${p.loanedToTeamName.toUpperCase()}`
          : p.source !== 'regular'
            ? p.source.toUpperCase()
            : '';
        return (
          <div
            className={`record-player-row record-player-row-readonly ${goals ? 'record-player-row-active' : ''} ${
              !p.confirmed ? 'record-player-row-unconfirmed' : ''
            }`}
            key={p.id}
          >
            {mode === 'attendance' ? (
              <input
                type="checkbox"
                className="attendance-checkbox"
                checked={p.checked}
                disabled={!!p.loanedToTeamName}
                onChange={() => onToggle(p.id, p.checked)}
                aria-label={`${p.name} attending`}
              />
            ) : (
              <span className={`gameday-attendance-dot ${p.confirmed ? '' : 'gameday-attendance-dot-out'}`} />
            )}
            <span className="record-player-name">{p.name}</span>
            <span className="record-player-position">{POSITION_ABBR[p.position]}</span>
            <span className="roster-source-badge" title={badgeText || undefined}>
              {badgeText}
            </span>
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
  const { match, loading, submitRosterBatch, submitCaptainScore } = useMatch(id);
  const attendancePending = usePendingChanges();
  const [confirmingAttendance, setConfirmingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [goalsByPlayer, setGoalsByPlayer] = useState({});
  const [otherGoals, setOtherGoals] = useState(0);
  const [scoreError, setScoreError] = useState(null);
  const [submittingScore, setSubmittingScore] = useState(false);

  const captainOfTeamIds = user?.captainOfTeamIds || [];
  const myCaptainedTeamId = match
    ? [match.home.id, match.away.id].find((teamId) => captainOfTeamIds.includes(teamId))
    : null;

  // Hydrate from an existing pending submission (e.g. re-opening the page,
  // or correcting a mistake) — runs once per match/captaincy, not on every
  // keystroke, since goalsByPlayer/otherGoals are otherwise purely local
  // state until "Submit Score" is pressed.
  useEffect(() => {
    if (!match || !myCaptainedTeamId) return;
    const mySubmission = (match.scoreSubmissions || []).find((s) => s.teamId === myCaptainedTeamId);
    if (!mySubmission) return;
    const isHome = myCaptainedTeamId === match.home.id;
    setGoalsByPlayer(mySubmission.scorers.reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {}));
    setOtherGoals(isHome ? mySubmission.awayGoals : mySubmission.homeGoals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, myCaptainedTeamId]);

  if (loading || !match) {
    return <p className="auth-loading">Loading...</p>;
  }

  const played = match.status === 'played';
  // Attendance has to actually be recorded (at least one real confirmed
  // row, not just the match being overdue) before scoring unlocks — a
  // captain shouldn't be able to submit a score, or even edit the
  // opponent's reported score, for a team they haven't checked anyone in
  // for yet.
  const myTeamInMatch = myCaptainedTeamId === match.home.id ? match.home : match.away;
  const myConfirmedCount = myCaptainedTeamId ? myTeamInMatch.players.filter((p) => p.confirmed).length : 0;
  const canSubmitScore = !played && !!myCaptainedTeamId && isMatchOverdue(match) && myConfirmedCount > 0;
  const isHome = myCaptainedTeamId === match.home.id;
  const otherTeam = isHome ? match.away : match.home;
  const otherSubmission = (match.scoreSubmissions || []).find((s) => s.teamId === otherTeam.id);
  const mySubmission = (match.scoreSubmissions || []).find((s) => s.teamId === myCaptainedTeamId);

  const myTotal = Object.values(goalsByPlayer).reduce((sum, v) => sum + v, 0);

  const getColumnMode = (teamId) => {
    if (played) return 'readonly';
    if (teamId === myCaptainedTeamId && canSubmitScore) return 'scoring';
    if (captainOfTeamIds.includes(teamId)) return 'attendance';
    return 'readonly';
  };

  // Stages the toggle locally instead of sending it immediately — see
  // usePendingChanges. Toggling a box back to its own server-confirmed
  // value drops the pending entry entirely, rather than staging a no-op
  // change, so the banner's count only ever reflects real, sendable edits.
  const handleToggle = (teamId, playerId, currentlyChecked) => {
    const key = `${playerId}:${teamId}`;
    const nextChecked = !currentlyChecked;
    const serverConfirmed = [match.home, match.away]
      .find((t) => t.id === teamId)
      ?.players.some((p) => p.id === playerId && p.confirmed);
    if (nextChecked === serverConfirmed) {
      attendancePending.unstage(key);
    } else {
      attendancePending.stage(key, { playerId, teamId, action: nextChecked ? 'add' : 'remove', source: 'regular' });
    }
  };

  const handleConfirmAttendance = async () => {
    setAttendanceError(null);
    setConfirmingAttendance(true);
    try {
      await submitRosterBatch(Array.from(attendancePending.pending.values()));
      attendancePending.clear();
    } catch (err) {
      setAttendanceError(err.message);
    } finally {
      setConfirmingAttendance(false);
    }
  };

  const handleSubmitScore = async () => {
    setScoreError(null);
    setSubmittingScore(true);
    try {
      const scorers = Object.entries(goalsByPlayer)
        .filter(([, g]) => g > 0)
        .map(([playerId, goals]) => ({ playerId: Number(playerId), goals }));
      const homeGoals = isHome ? myTotal : otherGoals;
      const awayGoals = isHome ? otherGoals : myTotal;
      await submitCaptainScore({ homeGoals, awayGoals, scorers });
    } catch (err) {
      setScoreError(err.message);
    } finally {
      setSubmittingScore(false);
    }
  };

  let scoreStatus = null;
  if (canSubmitScore && mySubmission && otherSubmission) {
    const agree = mySubmission.homeGoals === otherSubmission.homeGoals && mySubmission.awayGoals === otherSubmission.awayGoals;
    scoreStatus = agree
      ? 'Both teams reported the same score — sent to the admin to finalize.'
      : "Scores don't match — flagged for the admin to review.";
  } else if (canSubmitScore && mySubmission) {
    scoreStatus = `You reported ${mySubmission.homeGoals}-${mySubmission.awayGoals}. Waiting on ${otherTeam.name}.`;
  }

  const homeFullRoster = teams?.find((t) => t.id === match.home.id)?.players;
  const awayFullRoster = teams?.find((t) => t.id === match.away.id)?.players;

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={() => navigate('/schedule')}>
          &lt; Calendar
        </button>
        <span className="notify-breadcrumb-title">Gameday</span>
        <span className="generated-subtitle">Mon · {fullDate(parseMatchDate(match.matchDate))}</span>
        {canSubmitScore && (
          <button
            className="pill-btn pill-btn-blue notify-send-btn"
            onClick={handleSubmitScore}
            disabled={submittingScore}
          >
            {submittingScore ? 'Submitting...' : 'Submit Score'}
          </button>
        )}
      </div>

      {scoreError && <p className="options-warning">{scoreError}</p>}
      {scoreStatus && <p className="empty-state-subtitle">{scoreStatus}</p>}

      <div className="panel record-score-header">
        <span className="record-score-team">{match.home.name}</span>
        {played ? (
          <div className="record-score-boxes">
            <span className="record-score-box">{match.homeGoals}</span>
            <span>:</span>
            <span className="record-score-box">{match.awayGoals}</span>
          </div>
        ) : canSubmitScore ? (
          <div className="record-score-boxes">
            {isHome ? (
              <>
                <span className="record-score-box">{myTotal}</span>
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  className="record-score-box record-score-box-input"
                  value={otherGoals}
                  onChange={(e) => setOtherGoals(Math.max(0, Number(e.target.value) || 0))}
                />
              </>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  className="record-score-box record-score-box-input"
                  value={otherGoals}
                  onChange={(e) => setOtherGoals(Math.max(0, Number(e.target.value) || 0))}
                />
                <span>:</span>
                <span className="record-score-box">{myTotal}</span>
              </>
            )}
          </div>
        ) : (
          <span className="badge badge-count">Scheduled</span>
        )}
        <span className="record-score-team record-score-team-right">{match.away.name}</span>
      </div>

      <PendingChangesBanner
        count={attendancePending.count}
        onConfirm={handleConfirmAttendance}
        confirming={confirmingAttendance}
        error={attendanceError}
        label="Confirm attendance"
      />

      <div className="record-roster-grid">
        <RosterColumn
          team={match.home}
          fullRoster={homeFullRoster}
          isMyTeam={match.home.id === myTeamId}
          scorers={match.scorers}
          mode={getColumnMode(match.home.id)}
          onToggle={(playerId, checked) => handleToggle(match.home.id, playerId, checked)}
          pending={attendancePending}
          goalsByPlayer={goalsByPlayer}
          onGoalChange={(playerId, val) => setGoalsByPlayer((prev) => ({ ...prev, [playerId]: val }))}
        />
        <RosterColumn
          team={match.away}
          fullRoster={awayFullRoster}
          isMyTeam={match.away.id === myTeamId}
          scorers={match.scorers}
          mode={getColumnMode(match.away.id)}
          onToggle={(playerId, checked) => handleToggle(match.away.id, playerId, checked)}
          pending={attendancePending}
          goalsByPlayer={goalsByPlayer}
          onGoalChange={(playerId, val) => setGoalsByPlayer((prev) => ({ ...prev, [playerId]: val }))}
        />
      </div>
    </div>
  );
}

export default GameDayView;
