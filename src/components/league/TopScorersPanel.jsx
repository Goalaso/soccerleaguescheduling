import React from 'react';

function TopScorersPanel({ topScorers }) {
  return (
    <div className="panel sidebar-card">
      <h3 className="panel-title">Top Scorers</h3>
      {topScorers.map((player, index) => (
        <div className="top-scorer-row" key={player.id}>
          <span className="top-scorer-rank">{index + 1}</span>
          <span className="top-scorer-info">
            <span className="player-name">{player.name}</span>
            <span className="top-scorer-team">{player.teamName}</span>
          </span>
          <span className="top-scorer-goals">{player.goals}g</span>
        </div>
      ))}
    </div>
  );
}

export default TopScorersPanel;
