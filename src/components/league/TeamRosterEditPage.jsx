import React, { useState } from 'react';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePlayers } from '../../hooks/usePlayers';

// Admin-only, permanent season-long roster changes — distinct from the
// per-match loans on the schedule/record-results screens. Moving a player
// updates team_players for the rest of the season; it doesn't touch any
// match that's already been played (match_rosters keeps its own snapshot).
// Its own page rather than a collapsible panel on the team profile — the
// controls (captain picker, per-player move/remove, two separate add
// flows) were cramped and easy to trigger by accident inline.
function TeamRosterEditPage({ team, allTeams, seasonId, onBack, addSeasonPlayer, removeSeasonPlayer, moveSeasonPlayer, setCaptain }) {
  const [busy, setBusy] = useState(false);
  const [addPick, setAddPick] = useState('');
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
  const handleAdd = () => {
    if (!addPick) return;
    withBusy(() => addSeasonPlayer(team.id, Number(addPick))).then(() => setAddPick(''));
  };
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
