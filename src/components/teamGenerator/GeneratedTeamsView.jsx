import React, { useState } from 'react';
import TeamCard from './TeamCard';

function GeneratedTeamsView({
  teams,
  playerCount,
  isPublished,
  publishError,
  unassignedPlayers,
  onRegenerate,
  onPublish,
  onMovePlayer,
  onRemovePlayer,
  onAddPlayer,
  onRenameTeam,
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="panel generated-panel">
      <div className="generated-header">
        <div className="generated-heading">
          <h3 className="panel-title">Generated Teams</h3>
          <span className="badge badge-count">{teams.length} Teams</span>
          <span className="generated-subtitle">
            Monday Night League · Winter 2026 · {playerCount} players
          </span>
        </div>
        <div className="generated-actions">
          <button className="outline-btn" onClick={onRegenerate}>
            Regenerate
          </button>
          {!isPublished && (
            <button className="outline-btn" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done Editing' : 'Edit Teams'}
            </button>
          )}
          {!isPublished && (
            <button className="pill-btn pill-btn-blue" onClick={onPublish}>
              Save &amp; Publish
            </button>
          )}
        </div>
      </div>

      {publishError && <p className="options-warning">{publishError}</p>}

      <div className="team-grid">
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            editing={editing}
            otherTeams={teams.filter((t) => t.id !== team.id)}
            onMove={(playerId, toTeamId) => onMovePlayer(playerId, team.id, toTeamId)}
            onRemove={(playerId) => onRemovePlayer(playerId, team.id)}
            onRename={(name) => onRenameTeam(team.id, name)}
          />
        ))}
      </div>

      {editing && (
        <div className="panel unassigned-players-panel">
          <h3 className="panel-title">Unassigned Players</h3>
          {unassignedPlayers.length === 0 ? (
            <p className="empty-state-subtitle">Every eligible player is on a team.</p>
          ) : (
            <div className="unassigned-players-list">
              {unassignedPlayers.map((p) => (
                <div className="unassigned-player-chip" key={p.id}>
                  <span>{p.name}</span>
                  <select
                    className="select-input"
                    value=""
                    onChange={(e) => e.target.value && onAddPlayer(p.id, Number(e.target.value))}
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
  );
}

export default GeneratedTeamsView;
