import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSelectedSeason } from '../../context/SelectedSeasonContext';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';

const POSITION_CLASS = {
  Midfielder: 'badge-midfielder',
  Forward: 'badge-forward',
  Defender: 'badge-defender',
  Goalkeeper: 'badge-goalkeeper',
};

function skillBarClass(skill) {
  if (skill >= 7) return 'skill-bar-high';
  if (skill >= 5) return 'skill-bar-mid';
  return 'skill-bar-low';
}

// Every player across every team in the season, with position/skill (same
// card look as the team roster/generator screens, for visual consistency)
// plus goals scored *for that team* (season.teamPlayerGoals — never a
// loaned player's goals for someone else's team) and games played. Entering
// from a specific team's "Player Stats" button pre-filters via ?team=; the
// league-wide tab leaves it unfiltered.
//
// Admins additionally get a "Move to..." dropdown per row and an "Available
// to Add" side panel (season-available players not yet on any team) — the
// point of seeing games/goals alongside position/skill here is to spot an
// imbalance and act on it immediately, without leaving this page for the
// separate per-team roster editor.
function PlayerStatsView({ season, gamesPlayedByPlayer, batchEditRoster, onBack }) {
  const [searchParams] = useSearchParams();
  const teamFilter = searchParams.get('team');
  const [sortKey, setSortKey] = useState('goals');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { selectedSeasonId } = useSelectedSeason();
  const { players: availability } = useSeasonAvailability(selectedSeasonId);
  const [busyPlayerId, setBusyPlayerId] = useState(null);
  const [actionError, setActionError] = useState(null);
  // Read-only by default, even for admins — the Move/Add roster controls
  // (and the whole second "Available to Add" card) only appear once this
  // is explicitly opened, so a casual glance at stats doesn't also expose
  // roster-editing UI nobody asked to see yet.
  const [editingRoster, setEditingRoster] = useState(false);
  const showEditControls = isAdmin && editingRoster;

  const teams = season.standings.map((s) => s.team);
  const rosteredIds = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
  const subPool = availability.filter((p) => p.isAvailable && !rosteredIds.has(p.playerId));

  const rows = useMemo(() => {
    const all = season.standings.flatMap(({ team }) =>
      team.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        skill: p.skill,
        teamId: team.id,
        teamName: team.name,
        goals: (season.teamPlayerGoals[team.id] || {})[p.id] || 0,
        gamesPlayed: gamesPlayedByPlayer[p.id] || 0,
      }))
    );
    const filtered = teamFilter ? all.filter((r) => String(r.teamId) === teamFilter) : all;
    return [...filtered].sort((a, b) => b[sortKey] - a[sortKey] || a.name.localeCompare(b.name));
  }, [season, gamesPlayedByPlayer, teamFilter, sortKey]);

  const filteredTeamName = teamFilter
    ? season.standings.find((s) => String(s.team.id) === teamFilter)?.team.name
    : null;

  const handleMove = async (row, toTeamId) => {
    if (!toTeamId) return;
    setActionError(null);
    setBusyPlayerId(row.id);
    try {
      await batchEditRoster({
        operations: [{ action: 'move', playerId: row.id, teamId: row.teamId, toTeamId: Number(toTeamId) }],
      });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleAdd = async (playerId, toTeamId) => {
    if (!toTeamId) return;
    setActionError(null);
    setBusyPlayerId(playerId);
    try {
      await batchEditRoster({ operations: [{ action: 'add', playerId, teamId: Number(toTeamId) }] });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyPlayerId(null);
    }
  };

  const rowClass = `player-stats-row ${showEditControls ? 'player-stats-row-admin' : ''}`;

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Standings
        </button>
        <span className="notify-breadcrumb-title">Player Stats</span>
        {filteredTeamName && <span className="generated-subtitle">{filteredTeamName}</span>}
        {isAdmin && (
          <button
            type="button"
            className="outline-btn notify-send-btn"
            onClick={() => setEditingRoster((v) => !v)}
          >
            {editingRoster ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {actionError && <p className="options-warning">{actionError}</p>}

      <div className={`team-grid player-stats-grid ${showEditControls ? '' : 'player-stats-grid-solo'}`}>
        <div className="team-card-v2 player-stats-card" style={{ '--team-color': 'var(--accent)' }}>
          <div className="team-card-header">
            <h4>Player Stats</h4>
            <span className="team-avg-badge">{rows.length}</span>
          </div>

          <div className={`${rowClass} player-table-head`}>
            <span>Player</span>
            <span>Position</span>
            <span>Skill</span>
            <span>Team</span>
            <span>
              <button type="button" className="link-btn" onClick={() => setSortKey('gamesPlayed')}>
                Games{sortKey === 'gamesPlayed' ? ' ▾' : ''}
              </button>
            </span>
            <span>
              <button type="button" className="link-btn" onClick={() => setSortKey('goals')}>
                Goals{sortKey === 'goals' ? ' ▾' : ''}
              </button>
            </span>
            {showEditControls && <span>Move</span>}
          </div>

          <div className="team-player-list">
            {rows.map((r) => (
              <div className={rowClass} key={r.id}>
                <span className="player-name">{r.name}</span>
                <span className={`badge ${POSITION_CLASS[r.position]}`}>{r.position}</span>
                <span className="skill-cell">
                  <span className="skill-number">{r.skill}</span>
                  <span className="skill-bar-track">
                    <span className={`skill-bar-fill ${skillBarClass(r.skill)}`} style={{ width: `${r.skill * 10}%` }} />
                  </span>
                </span>
                <span>{r.teamName}</span>
                <span>{r.gamesPlayed}</span>
                <span>{r.goals}</span>
                {showEditControls && (
                  <select
                    className="select-input"
                    value=""
                    disabled={busyPlayerId === r.id}
                    onChange={(e) => handleMove(r, e.target.value)}
                  >
                    <option value="">Move to...</option>
                    {teams
                      .filter((t) => t.id !== r.teamId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {showEditControls && (
          <div className="team-card-v2 unassigned-team-card" style={{ '--team-color': 'var(--text-faint)' }}>
            <div className="team-card-header">
              <h4>Available to Add</h4>
              <span className="team-avg-badge">{subPool.length}</span>
            </div>
            {subPool.length === 0 ? (
              <p className="empty-state-subtitle">Every available player is already on a team.</p>
            ) : (
              <div className="team-player-list">
                {subPool.map((p) => (
                  <div className="unassigned-player-row" key={p.playerId}>
                    <span className="player-name">{p.name}</span>
                    <span className={`badge ${POSITION_CLASS[p.position]}`}>{p.position}</span>
                    <span className="skill-cell">
                      <span className="skill-number">{p.skill}</span>
                      <span className="skill-bar-track">
                        <span
                          className={`skill-bar-fill ${skillBarClass(p.skill)}`}
                          style={{ width: `${p.skill * 10}%` }}
                        />
                      </span>
                    </span>
                    <select
                      className="select-input"
                      value=""
                      disabled={busyPlayerId === p.playerId}
                      onChange={(e) => handleAdd(p.playerId, e.target.value)}
                    >
                      <option value="">Add to...</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerStatsView;
