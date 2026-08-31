import React, { useState } from 'react';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePlayers } from '../../hooks/usePlayers';
import TeamRosterCard from './TeamRosterCard';
import SeasonSubPoolCard from './SeasonSubPoolCard';

// Admin-only, permanent season-long roster changes — distinct from the
// per-match loans on the schedule/record-results screens. Moving a player
// updates team_players for the rest of the season; it doesn't touch any
// match that's already been played (match_rosters keeps its own snapshot).
// Laid out like the team generator's card grid (a card for this team, a
// card for who could be added to it) rather than plain list rows, for the
// same at-a-glance position/skill visibility that screen has.
function TeamRosterEditPage({ team, allTeams, seasonId, onBack, addSeasonPlayer, removeSeasonPlayer, moveSeasonPlayer, setCaptain }) {
  const [busy, setBusy] = useState(false);
  const [newSeasonPick, setNewSeasonPick] = useState('');
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
  const handleAdd = (playerId) => withBusy(() => addSeasonPlayer(team.id, playerId));
  const handleAddToSeason = () => {
    if (!newSeasonPick) return;
    withBusy(() => addToSeason(Number(newSeasonPick))).then(() => setNewSeasonPick(''));
  };
  const handleCaptain = (e) => {
    const val = e.target.value;
    withBusy(() => setCaptain(team.id, val ? Number(val) : null));
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
      </div>

      <div className="team-grid">
        <TeamRosterCard team={team} otherTeams={otherTeams} busy={busy} onMove={handleMove} onRemove={handleRemove} />
        <SeasonSubPoolCard players={subPool} busy={busy} onAdd={handleAdd} />
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
            disabled={busy || !newSeasonPick}
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
