import React, { useState } from 'react';
import TeamSummaryCard from './TeamSummaryCard';
import RosterTable from './RosterTable';
import SkillByPositionPanel from './SkillByPositionPanel';
import PositionBreakdownPanel from './PositionBreakdownPanel';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';

// Admin-only, permanent season-long roster changes — distinct from the
// per-match loans on the schedule/record-results screens. Moving a player
// updates team_players for the rest of the season; it doesn't touch any
// match that's already been played (match_rosters keeps its own snapshot).
function TeamRosterEditor({ team, allTeams, seasonId, addSeasonPlayer, removeSeasonPlayer, moveSeasonPlayer, setCaptain }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addPick, setAddPick] = useState('');
  const { players: availability } = useSeasonAvailability(seasonId);

  const otherTeams = allTeams.filter((t) => t.id !== team.id);
  const rosteredIds = new Set(allTeams.flatMap((t) => t.players.map((p) => p.id)));
  const subPool = availability.filter((p) => p.isAvailable && !rosteredIds.has(p.playerId));

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleMove = (playerId, toTeamId) => {
    if (!toTeamId) return;
    withBusy(() => moveSeasonPlayer(team.id, playerId, Number(toTeamId)));
  };
  const handleRemove = (playerId) => withBusy(() => removeSeasonPlayer(team.id, playerId));
  const handleAdd = () => {
    if (!addPick) return;
    withBusy(() => addSeasonPlayer(team.id, Number(addPick))).then(() => setAddPick(''));
  };
  const handleCaptain = (e) => {
    const val = e.target.value;
    withBusy(() => setCaptain(team.id, val ? Number(val) : null));
  };

  return (
    <div className="panel team-roster-editor-panel">
      <div className="players-panel-header">
        <h3 className="panel-title">Edit Roster (Admin)</h3>
        <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="option-group">
            <span className="option-label">Team Captain</span>
            <select
              className="select-input"
              value={team.captainPlayerId || ''}
              disabled={busy}
              onChange={handleCaptain}
            >
              <option value="">No captain assigned</option>
              {team.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {team.players.map((p) => (
            <div className="checkbox-row" key={p.id}>
              <span>{p.name}</span>
              <select
                className="select-input"
                value=""
                disabled={busy}
                onChange={(e) => handleMove(p.id, e.target.value)}
              >
                <option value="">Move to...</option>
                {otherTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="link-btn link-btn-danger"
                disabled={busy}
                onClick={() => handleRemove(p.id)}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="roster-manager-add-row">
            <select className="select-input" value={addPick} onChange={(e) => setAddPick(e.target.value)}>
              <option value="">Add player from sub pool...</option>
              {subPool.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="outline-btn" disabled={busy || !addPick} onClick={handleAdd}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TeamProfileView({
  team,
  standing,
  rank,
  recentForm,
  topScorer,
  playerGoals,
  onBack,
  onGoToSchedule,
  isAdmin,
  allTeams,
  seasonId,
  addSeasonPlayer,
  removeSeasonPlayer,
  moveSeasonPlayer,
  setCaptain,
}) {
  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Match History
        </button>
        <span className="notify-breadcrumb-title">{team.name} — Profile</span>
        <span className="generated-subtitle">
          Monday Night League · Winter 2026
        </span>
        <div className="league-breadcrumb-actions">
          <button className="outline-btn" onClick={onGoToSchedule}>
            Schedule
          </button>
        </div>
      </div>

      <div className="league-profile-grid">
        <TeamSummaryCard
          team={team}
          standing={standing}
          rank={rank}
          recentForm={recentForm}
          topScorer={topScorer}
          variant="profile"
        />
        <RosterTable players={team.players} playerGoals={playerGoals} />
        <div className="notify-sidebar">
          <SkillByPositionPanel players={team.players} />
          <PositionBreakdownPanel players={team.players} />
        </div>
      </div>

      {isAdmin && (
        <TeamRosterEditor
          team={team}
          allTeams={allTeams}
          seasonId={seasonId}
          addSeasonPlayer={addSeasonPlayer}
          removeSeasonPlayer={removeSeasonPlayer}
          moveSeasonPlayer={moveSeasonPlayer}
          setCaptain={setCaptain}
        />
      )}
    </div>
  );
}

export default TeamProfileView;
