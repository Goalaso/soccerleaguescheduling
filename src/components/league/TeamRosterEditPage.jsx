import React, { useState } from 'react';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePlayers } from '../../hooks/usePlayers';
import { usePendingChanges } from '../../hooks/usePendingChanges';
import TeamRosterCard from './TeamRosterCard';
import SeasonSubPoolCard from './SeasonSubPoolCard';
import PendingChangesBanner from '../shared/PendingChangesBanner';

// Admin-only, permanent season-long roster changes — distinct from the
// per-match loans on the schedule/record-results screens. Moving a player
// updates team_players for the rest of the season; it doesn't touch any
// match that's already been played (match_rosters keeps its own snapshot).
// Laid out like the team generator's card grid (a card for this team, a
// card for who could be added to it) rather than plain list rows, for the
// same at-a-glance position/skill visibility that screen has.
function TeamRosterEditPage({ team, allTeams, seasonId, onBack, batchEditRoster }) {
  const [newSeasonPick, setNewSeasonPick] = useState('');
  const [addingToSeason, setAddingToSeason] = useState(false);
  const [pendingCaptainId, setPendingCaptainId] = useState(undefined); // undefined = no staged change
  const [confirming, setConfirming] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const rosterPending = usePendingChanges();
  const { players: availability, addToSeason } = useSeasonAvailability(seasonId);
  const { players: allPlayers } = usePlayers();

  const otherTeams = allTeams.filter((t) => t.id !== team.id);
  const rosteredIds = new Set(allTeams.flatMap((t) => t.players.map((p) => p.id)));
  const subPool = availability.filter((p) => p.isAvailable && !rosteredIds.has(p.playerId));

  // Players who don't have an availability row for this season at all yet —
  // e.g. someone approved off the waitlist, or who just signed up, after
  // this season was already created. Distinct from subPool above, which is
  // for players who already have a row and are simply unrostered.
  const availabilityIds = new Set(availability.map((p) => p.playerId));
  const newSeasonPool = allPlayers.filter((p) => !availabilityIds.has(p.id) && !rosteredIds.has(p.id));

  const pendingEntries = Array.from(rosterPending.pending.values());
  const removedOrMovedOutIds = new Set(
    pendingEntries.filter((c) => c.action === 'remove' || c.action === 'move').map((c) => c.playerId)
  );
  const pendingAdds = pendingEntries.filter((c) => c.action === 'add');
  const pendingAddedIds = new Set(pendingAdds.map((c) => c.playerId));

  // A pending add has no team_players row yet, so it isn't in team.players
  // — look its full details up from wherever it actually came from (the
  // sub pool) instead of carrying them in the pending change object itself.
  const findPlayerInfo = (playerId) => {
    const fromPool = subPool.find((p) => p.playerId === playerId);
    if (!fromPool) return null;
    return { id: fromPool.playerId, name: fromPool.name, position: fromPool.position, skill: fromPool.skill };
  };

  // This team's roster with staged-but-unsent moves/removes/adds already
  // applied, so the card reflects what a confirm would actually produce
  // instead of stale server data.
  const effectiveTeam = {
    ...team,
    players: [
      ...team.players.filter((p) => !removedOrMovedOutIds.has(p.id)),
      ...pendingAdds.map((c) => findPlayerInfo(c.playerId)).filter(Boolean),
    ],
  };
  const effectiveSubPool = subPool.filter((p) => !pendingAddedIds.has(p.playerId));

  const effectiveCaptainId = pendingCaptainId !== undefined ? pendingCaptainId : team.captainPlayerId;
  const totalPendingCount = rosterPending.count + (pendingCaptainId !== undefined ? 1 : 0);

  const handleMove = (playerId, toTeamId) => {
    if (!toTeamId) return;
    rosterPending.stage(playerId, { playerId, action: 'move', teamId: team.id, toTeamId: Number(toTeamId) });
  };
  const handleRemove = (playerId) => {
    rosterPending.stage(playerId, { playerId, action: 'remove', teamId: team.id });
  };
  const handleAdd = (playerId) => {
    rosterPending.stage(playerId, { playerId, action: 'add', teamId: team.id });
  };
  const handleCaptain = (e) => {
    const val = e.target.value;
    const next = val ? Number(val) : null;
    if (next === team.captainPlayerId) {
      setPendingCaptainId(undefined);
    } else {
      setPendingCaptainId(next);
    }
  };

  const pendingLabel = (c) => {
    if (c.action === 'add') return `Add ${findPlayerInfo(c.playerId)?.name || 'player'}`;
    const player = team.players.find((p) => p.id === c.playerId);
    if (c.action === 'remove') return `Remove ${player?.name || 'player'}`;
    const toTeam = otherTeams.find((t) => t.id === c.toTeamId);
    return `Move ${player?.name || 'player'} to ${toTeam?.name || 'another team'}`;
  };

  const handleConfirmRoster = async () => {
    setRosterError(null);
    setConfirming(true);
    try {
      await batchEditRoster({
        operations: pendingEntries.map((c) =>
          c.action === 'move'
            ? { action: 'move', playerId: c.playerId, teamId: c.teamId, toTeamId: c.toTeamId }
            : { action: c.action, playerId: c.playerId, teamId: c.teamId }
        ),
        captainPlayerId: pendingCaptainId,
        captainTeamId: pendingCaptainId !== undefined ? team.id : undefined,
      });
      rosterPending.clear();
      setPendingCaptainId(undefined);
    } catch (err) {
      setRosterError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleAddToSeason = async () => {
    if (!newSeasonPick) return;
    setAddingToSeason(true);
    try {
      await addToSeason(Number(newSeasonPick));
      setNewSeasonPick('');
    } finally {
      setAddingToSeason(false);
    }
  };

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; {team.name}
        </button>
        <span className="notify-breadcrumb-title">{team.name} — Edit Roster</span>
        <span className="generated-subtitle">Admin only</span>
      </div>

      <div className="panel team-roster-editor-panel">
        <div className="option-group">
          <span className="option-label">Team Captain</span>
          <select className="select-input" value={effectiveCaptainId || ''} onChange={handleCaptain}>
            <option value="">No captain assigned</option>
            {effectiveTeam.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PendingChangesBanner
        count={totalPendingCount}
        onConfirm={handleConfirmRoster}
        confirming={confirming}
        error={rosterError}
        label="Confirm roster changes"
      />

      {pendingEntries.length > 0 && (
        <div className="panel pending-roster-list">
          {pendingEntries.map((c) => (
            <div className="checkbox-row" key={c.playerId}>
              <span>{pendingLabel(c)}</span>
              <button
                type="button"
                className="link-btn link-btn-danger"
                onClick={() => rosterPending.unstage(c.playerId)}
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="team-grid">
        <TeamRosterCard team={effectiveTeam} otherTeams={otherTeams} busy={confirming} onMove={handleMove} onRemove={handleRemove} />
        <SeasonSubPoolCard players={effectiveSubPool} busy={confirming} onAdd={handleAdd} />
      </div>

      <div className="panel roster-add-to-season-panel">
        <div className="option-group roster-manager-add-row">
          <span className="option-label">Add to this season</span>
          <select
            className="select-input"
            value={newSeasonPick}
            onChange={(e) => setNewSeasonPick(e.target.value)}
          >
            <option value="">Player not yet part of this season...</option>
            {newSeasonPool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="outline-btn"
            disabled={addingToSeason || !newSeasonPick}
            onClick={handleAddToSeason}
          >
            Add to Season
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamRosterEditPage;
