import React from 'react';
import TeamSummaryCard from './TeamSummaryCard';
import MatchHistoryList from './MatchHistoryList';
import UpcomingGameCard from './UpcomingGameCard';
import TeamPlayersPanel from './TeamPlayersPanel';

function TeamHistoryView({
  team,
  standing,
  rank,
  recentForm,
  topScorer,
  matches,
  nextMatch,
  teamGoals,
  gamesPlayedByPlayer,
  onBack,
  onGoToProfile,
  onSelectMatch,
}) {
  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Standings
        </button>
        <span className="notify-breadcrumb-title">{team.name}</span>
        <span className="generated-subtitle">
          Monday Night League · Winter 2026
        </span>
        <div className="league-breadcrumb-actions">
          <button className="pill-btn pill-btn-blue" onClick={onGoToProfile}>
            Team Page &rarr;
          </button>
        </div>
      </div>

      <div className="team-history-grid">
        <TeamSummaryCard
          team={team}
          standing={standing}
          rank={rank}
          recentForm={recentForm}
          topScorer={topScorer}
          variant="history"
        />
        <div className="team-history-matches-col">
          <MatchHistoryList team={team} matches={matches} onSelectMatch={onSelectMatch} />
          <UpcomingGameCard team={team} match={nextMatch} onSelectMatch={onSelectMatch} />
        </div>
        <TeamPlayersPanel players={team.players} teamGoals={teamGoals} gamesPlayedByPlayer={gamesPlayedByPlayer} />
      </div>
    </div>
  );
}

export default TeamHistoryView;
