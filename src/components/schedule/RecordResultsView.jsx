import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../../hooks/useMatch';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePendingChanges } from '../../hooks/usePendingChanges';
import { formatMatchDate, isMatchOverdue, parseMatchDate } from '../../utils/season';
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
            <div className="record-goal-controls">
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
          </div>
        );
      })}
    </div>
  );
}

// Admin-only match-day roster editor: confirm/unconfirm each team's regular
// roster (same toggle a captain does), plus add a sub (available this
// season, not on any team) or borrow a player from any other team in the
// season. Works before the match (assigning subs) or after a score's
// already recorded (in-game swap bookkeeping/correction) — it's just
// "edit this match's roster," usable any time this screen is open.
function RosterManager({ match, teams, seasonId, matches, rosterPending }) {
  const [expanded, setExpanded] = useState(false);
  const [picks, setPicks] = useState({});
  const { players: availability } = useSeasonAvailability(seasonId);

  if (!teams) return null;

  const fullRosterFor = (teamId) => teams.find((t) => t.id === teamId)?.players || [];
  const rosteredIds = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
  const subPool = availability.filter((p) => p.isAvailable && !rosteredIds.has(p.playerId));
  const seasonAvailableIds = new Set(availability.filter((p) => p.isAvailable).map((p) => p.playerId));

  // A pending guest add has no real match_rosters row yet, so it isn't in
  // match.players — look its display name up from wherever it actually
  // came from (the season-wide availability list for a sub, or another
  // team's roster for a borrow) instead of carrying it in the pending
  // change object itself.
  const candidateName = (playerId, source) => {
    if (source === 'sub') return availability.find((a) => a.playerId === playerId)?.name || 'Unknown player';
    return teams.flatMap((t) => t.players).find((p) => p.id === playerId)?.name || 'Unknown player';
  };

  // "Checked in today" count for a team not playing in this match — looked
  // up from its own match this same round (every match in a round plays
  // simultaneously, same reasoning the backend uses to clear a borrowed
  // player from their own team's match). null if that team has a bye.
  const todayCountFor = (teamId) => {
    const theirMatch = (matches || []).find(
      (m) => m.week === match.week && m.id !== match.id && (m.home.id === teamId || m.away.id === teamId)
    );
    if (!theirMatch) return null;
    return theirMatch.home.id === teamId ? theirMatch.home.confirmedCount : theirMatch.away.confirmedCount;
  };

  // A sub already placed on one of THIS match's two teams (the only teams a
  // sub can be added to) still shows up in the other team's dropdown — per
  // design, don't hide them, just make it obvious where they currently are.
  const subPlacement = {};
  [match.home, match.away].forEach((t) => {
    t.players
      .filter((p) => p.source === 'sub')
      .forEach((p) => {
        subPlacement[p.id] = { teamName: t.name, count: t.players.length };
      });
  });

  const candidateLabel = (c) => {
    if (c.source === 'sub') {
      const placed = subPlacement[c.id];
      return placed ? `${c.name} (sub) (${placed.teamName}, ${placed.count})` : `${c.name} (sub)`;
    }
    return c.count != null ? `${c.name} (${c.teamName}, ${c.count})` : `${c.name} (${c.teamName})`;
  };

  // Stages instead of sending immediately — see usePendingChanges. Toggling
  // a box back to its own server-confirmed value drops the pending entry
  // entirely, so the banner's count only reflects real, sendable edits.
  const handleToggleRegular = (teamId, playerId, currentlyChecked) => {
    const key = `${playerId}:${teamId}`;
    const nextChecked = !currentlyChecked;
    const serverConfirmed = (teamId === match.home.id ? match.home : match.away).players.some(
      (p) => p.id === playerId && p.confirmed
    );
    if (nextChecked === serverConfirmed) {
      rosterPending.unstage(key);
    } else {
      rosterPending.stage(key, { playerId, teamId, action: nextChecked ? 'add' : 'remove', source: 'regular' });
    }
  };

  const handleRemove = (teamId, playerId) => {
    rosterPending.stage(`${playerId}:${teamId}`, { playerId, teamId, action: 'remove' });
  };

  const handleAdd = (team) => {
    const pick = picks[team.id];
    if (!pick) return;
    const [source, playerIdStr] = pick.split(':');
    const playerId = Number(playerIdStr);
    rosterPending.stage(`${playerId}:${team.id}`, { playerId, teamId: team.id, action: 'add', source });
    setPicks((prev) => ({ ...prev, [team.id]: '' }));
  };

  const renderTeam = (team) => {
    const fullRoster = fullRosterFor(team.id);
    // team.players is the match's effective roster, which still falls back
    // to listing the whole season roster before anyone's touched this
    // match — that's so the team stays visible (e.g. to log a goal), not
    // because everyone's actually confirmed. p.confirmed distinguishes a
    // real roll-call/add row from that fallback. Layer this team's pending,
    // not-yet-sent changes on top of that server truth before computing
    // anything else, so staged edits show up immediately.
    const teamPending = Array.from(rosterPending.pending.values()).filter((c) => c.teamId === team.id);
    const pendingRemovedIds = new Set(teamPending.filter((c) => c.action === 'remove').map((c) => c.playerId));
    const pendingAdds = teamPending.filter((c) => c.action === 'add');
    const pendingAddedRegularIds = new Set(pendingAdds.filter((c) => c.source === 'regular').map((c) => c.playerId));
    const pendingAddedGuests = pendingAdds.filter((c) => c.source !== 'regular');

    const confirmedIds = new Set(
      team.players.filter((p) => p.confirmed && !pendingRemovedIds.has(p.id)).map((p) => p.id)
    );
    pendingAddedRegularIds.forEach((pid) => confirmedIds.add(pid));

    const guests = team.players.filter((p) => p.source !== 'regular' && !pendingRemovedIds.has(p.id));

    const borrowable = teams
      .filter((t) => t.id !== team.id)
      .flatMap((t) => {
        if (t.id === match.home.id || t.id === match.away.id) {
          // Playing in this match — only offer players actually checked in
          // for today, not just anyone on the team's season roster. Count
          // is live (this match's own fetched data), not the possibly-stale
          // season list, since it's kept in sync with every add/remove here.
          const matchTeam = t.id === match.home.id ? match.home : match.away;
          const attendingPlayers = matchTeam.players.filter((p) => p.confirmed);
          const attendingIds = new Set(attendingPlayers.map((p) => p.id));
          return t.players
            .filter((p) => attendingIds.has(p.id))
            .map((p) => ({ ...p, teamName: t.name, count: attendingPlayers.length }));
        }
        // Not playing this match — no per-match attendance signal exists for
        // them, so fall back to season availability (same signal subPool uses).
        return t.players
          .filter((p) => seasonAvailableIds.has(p.id))
          .map((p) => ({ ...p, teamName: t.name, count: todayCountFor(t.id) }));
      })
      .filter((p) => !confirmedIds.has(p.id));

    // Anyone with a pending add anywhere (this team's guest slot, or any
    // team's regular checkbox) shouldn't also show as an addable candidate
    // — avoids staging the same player onto a roster twice before confirm.
    const allPendingAddedIds = new Set(
      Array.from(rosterPending.pending.values())
        .filter((c) => c.action === 'add')
        .map((c) => c.playerId)
    );

    const candidates = [
      ...subPool.map((p) => ({ id: p.playerId, name: p.name, source: 'sub' })),
      ...borrowable.map((p) => ({ id: p.id, name: p.name, source: 'borrowed', teamName: p.teamName, count: p.count })),
    ].filter((c) => !allPendingAddedIds.has(c.id));

    // Season-roster players currently loaned to another team this round
    // (this match's opponent, or a completely different match) — checking
    // them in here would either 409 or, worse, create a duplicate roster
    // entry across two matches at once, so disable and label instead.
    const loanedOut = team.loanedOut || {};

    return (
      <div className="roster-manager-team-col">
        <span className="option-label">{team.name}</span>
        {fullRoster.map((p) => (
          <label className="checkbox-row" key={p.id}>
            <input
              type="checkbox"
              checked={confirmedIds.has(p.id)}
              disabled={!!loanedOut[p.id]}
              onChange={() => handleToggleRegular(team.id, p.id, confirmedIds.has(p.id))}
            />
            <span>
              {p.name}
              {loanedOut[p.id] && (
                <span
                  className="roster-source-badge gameday-loaned-badge"
                  title={`LOANED TO ${loanedOut[p.id].toUpperCase()}`}
                >
                  LOANED TO {loanedOut[p.id].toUpperCase()}
                </span>
              )}
            </span>
          </label>
        ))}
        {guests.map((p) => (
          <div className="checkbox-row" key={p.id}>
            <span>
              {p.name} <span className="roster-source-badge">{p.source.toUpperCase()}</span>
            </span>
            <button type="button" className="link-btn link-btn-danger" onClick={() => handleRemove(team.id, p.id)}>
              Remove
            </button>
          </div>
        ))}
        {pendingAddedGuests.map((c) => (
          <div className="checkbox-row" key={`pending-${c.playerId}`}>
            <span>
              {candidateName(c.playerId, c.source)}{' '}
              <span className="roster-source-badge">{c.source.toUpperCase()} · PENDING</span>
            </span>
            <button
              type="button"
              className="link-btn link-btn-danger"
              onClick={() => rosterPending.unstage(`${c.playerId}:${team.id}`)}
            >
              Undo
            </button>
          </div>
        ))}
        <div className="roster-manager-add-row">
          <select
            className="select-input"
            value={picks[team.id] || ''}
            onChange={(e) => setPicks((prev) => ({ ...prev, [team.id]: e.target.value }))}
          >
            <option value="">Add sub or borrowed player...</option>
            {candidates.map((c) => (
              <option key={`${c.source}-${c.id}`} value={`${c.source}:${c.id}`}>
                {candidateLabel(c)}
              </option>
            ))}
          </select>
          <button type="button" className="outline-btn" disabled={!picks[team.id]} onClick={() => handleAdd(team)}>
            Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="panel roster-manager-panel">
      <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
        {expanded ? '▾' : '▸'} Manage Roster
      </button>
      {expanded && (
        <div className="roster-manager-grid">
          {renderTeam(match.home)}
          {renderTeam(match.away)}
        </div>
      )}
    </div>
  );
}

// Read-only display of what each team's captain reported, if anything —
// never writes anything itself. "Use Reported Scores" just prefills the
// admin's own goalsByPlayer state below; the admin still reviews and hits
// the normal Submit Results button to actually finalize.
function CaptainReportedScores({ match, onUse }) {
  const submissions = match.scoreSubmissions || [];
  if (!submissions.length) return null;

  const teamFor = (teamId) => (teamId === match.home.id ? match.home : match.away);
  const playerName = (teamId, playerId) =>
    teamFor(teamId).players.find((p) => p.id === playerId)?.name || 'Unknown player';

  const agree =
    submissions.length === 2 &&
    submissions[0].homeGoals === submissions[1].homeGoals &&
    submissions[0].awayGoals === submissions[1].awayGoals;

  return (
    <div className="panel captain-reports-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Captain-Reported Scores</h3>
        {submissions.length === 2 && (
          <span className={`badge badge-count ${agree ? 'status-published' : ''}`}>
            {agree ? 'Scores Agree' : 'Scores Conflict'}
          </span>
        )}
      </div>
      {submissions.map((s) => (
        <p className="captain-report-row" key={s.teamId}>
          <span className="option-label">{teamFor(s.teamId).name}</span> reported {s.homeGoals}-{s.awayGoals}
          {s.scorers.length > 0 &&
            ` — ${s.scorers.map((sc) => `${playerName(s.teamId, sc.playerId)} (${sc.goals})`).join(', ')}`}
        </p>
      ))}
      <button type="button" className="outline-btn" onClick={onUse}>
        Use Reported Scores
      </button>
    </div>
  );
}

function RecordResultsView({ matches, teams, seasonId, onResultsSaved }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { match, loading, submitResults, submitRosterBatch } = useMatch(id);
  const rosterPending = usePendingChanges();
  const [confirmingRoster, setConfirmingRoster] = useState(false);
  const [rosterError, setRosterError] = useState(null);

  const [homeGoalsByPlayer, setHomeGoalsByPlayer] = useState({});
  const [awayGoalsByPlayer, setAwayGoalsByPlayer] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(null);

  // Clicking into a different match (from the "still need a score" list, or
  // "Record Another Game") changes the :id route param but re-renders this
  // same component instance — React Router doesn't remount just because a
  // param changed. Without this, every piece of local per-match state below
  // would carry over from whichever match was open before — most visibly
  // `saved`, which would keep showing the previous match's "Results Saved!"
  // screen instead of the new match's entry form.
  useEffect(() => {
    setSaved(null);
    setError(null);
    setSubmitting(false);
    setRosterError(null);
    setConfirmingRoster(false);
    rosterPending.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleConfirmRoster = async () => {
    setRosterError(null);
    setConfirmingRoster(true);
    try {
      await submitRosterBatch(Array.from(rosterPending.pending.values()));
      rosterPending.clear();
    } catch (err) {
      setRosterError(err.message);
    } finally {
      setConfirmingRoster(false);
    }
  };

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

  const handleUseReportedScores = () => {
    const submissions = match.scoreSubmissions || [];
    const homeSubmission = submissions.find((s) => s.teamId === match.home.id);
    const awaySubmission = submissions.find((s) => s.teamId === match.away.id);

    if (homeSubmission) {
      setHomeGoalsByPlayer(homeSubmission.scorers.reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {}));
    }
    if (awaySubmission) {
      setAwayGoalsByPlayer(awaySubmission.scorers.reduce((acc, s) => ({ ...acc, [s.playerId]: s.goals }), {}));
    }
  };

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
    const otherPending = (matches || []).filter((m) => m.id !== match.id && isMatchOverdue(m));

    return (
      <div className="record-success">
        <div className="panel record-success-panel">
          <div className="record-success-header">
            <h3 className="modal-title">Results Saved!</h3>
            <p className="generated-subtitle">
              {fullDate(parseMatchDate(match.matchDate))} · {shortName(match.home.name)} vs{' '}
              {shortName(match.away.name)}
            </p>
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
          </div>

          <div className="record-success-grid">
          <div className="record-success-message">
            {otherPending.length > 0 && (
              <div className="record-warning-box">
                <p>
                  {otherPending.length} game{otherPending.length > 1 ? 's' : ''} still need
                  {otherPending.length === 1 ? 's' : ''} a score
                </p>
                {otherPending.slice(0, 3).map((m) => (
                  <p
                    key={m.id}
                    className="record-warning-item record-warning-item-clickable"
                    onClick={() => navigate(`/schedule/match/${m.id}`)}
                  >
                    Mon · {formatMatchDate(parseMatchDate(m.matchDate))} — {shortName(m.home.name)} vs{' '}
                    {shortName(m.away.name)}
                    <br />
                    <span className="generated-subtitle">Score has not been recorded yet.</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="record-success-score-box">
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
        <span className="generated-subtitle">Mon · {fullDate(parseMatchDate(match.matchDate))}</span>
        <button
          className="pill-btn pill-btn-blue notify-send-btn"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Saving...' : 'Submit Results'}
        </button>
      </div>

      {error && <p className="options-warning">{error}</p>}

      <CaptainReportedScores match={match} onUse={handleUseReportedScores} />

      <div className="panel record-score-header">
        <span className="record-score-team">{match.home.name}</span>
        <div className="record-score-boxes">
          <span className="record-score-box">{homeTotal || '—'}</span>
          <span>:</span>
          <span className="record-score-box">{awayTotal || '—'}</span>
        </div>
        <span className="record-score-team record-score-team-right">{match.away.name}</span>
      </div>

      <PendingChangesBanner
        count={rosterPending.count}
        onConfirm={handleConfirmRoster}
        confirming={confirmingRoster}
        error={rosterError}
        label="Confirm roster changes"
      />

      <RosterManager match={match} teams={teams} seasonId={seasonId} matches={matches} rosterPending={rosterPending} />

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
